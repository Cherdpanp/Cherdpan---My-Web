import { COORDS } from './city-coordinates.mjs';

// Fixed field allowlists: no passports, visas, immigration, prices, or free-text notes.
export const TABLES = {
  tours: { name: 'Tours', fields: {
    name: 'Tours', countries: 'Countries', places: 'Places/Activities',
    years: 'ปี พ.ศ.', yearsLegacy: 'พ.ศ.', yearsCE: 'ปี' } },
  countries: { name: 'Countries', fields: { name: 'Name' } },
  places: { name: 'Places/Activities', fields: {
    name: 'Name', tours: 'Tours', cities: 'Cities', day: 'Day', session: 'Session' } },
  cities: { name: 'Cities', fields: {
    nameTH: 'ชื่อไทย', nameEN: 'ชื่ออังกฤษ', nameCN: 'ชื่อจีน',
    displayName: 'เมืองปัจจุบัน', countries: 'Countries' } }
};
const array = value => Array.isArray(value) ? value : value == null ? [] : [value];
const text = value => typeof value === 'string' ? value.trim().slice(0,500) : '';
const ids = value => array(value).map(x => typeof x === 'string' ? x : x?.id).filter(x => /^rec[A-Za-z0-9]+$/.test(x || ''));
const names = value => array(value).map(x => typeof x === 'string' ? x : x?.name).filter(Boolean);
const cells = record => record.fields || record.cellValuesByFieldId || {};
const uniq = values => [...new Set(values)];
const canonical = name => name === 'UK' ? 'United Kingdom' : name;
const coordsByName = new Map(Object.entries(COORDS).map(([n,c]) => [n.toLocaleLowerCase(), c]));

export function normalizeTravel(raw, fetchedAt = new Date().toISOString()) {
  const countryMap = new Map((raw.countries || []).map(r => [r.id, canonical(text(cells(r)[TABLES.countries.fields.name]))]));
  const countryNames = value => uniq(ids(value).map(id => countryMap.get(id)).filter(Boolean));
  const f = TABLES.tours.fields;
  const tours = (raw.tours || []).map(r => {
    const v = cells(r);
    let years = names(v[f.years]).length ? names(v[f.years]) : names(v[f.yearsLegacy]);
    if (!years.length) years = names(v[f.yearsCE]).map(y => Number(y) + 543);
    years = uniq(years.map(Number).filter(y => Number.isInteger(y) && y >= 2400 && y <= 3000)).sort((a,b) => a-b);
    return { id:r.id, name:text(v[f.name]), years, countries:countryNames(v[f.countries]), placeIds:ids(v[f.places]) };
  }).filter(t => t.name).sort((a,b) => (b.years.at(-1)||0)-(a.years.at(-1)||0) || a.name.localeCompare(b.name,'th'));
  const tourIds = new Set(tours.map(t => t.id));
  const linkedPlaceIds = new Set(tours.flatMap(t => t.placeIds));
  const p = TABLES.places.fields;
  const places = (raw.places || []).map(r => {
    const v=cells(r);
    return {id:r.id, name:text(v[p.name]), tourIds:uniq([...ids(v[p.tours]), ...tours.filter(t=>t.placeIds.includes(r.id)).map(t=>t.id)]).filter(id=>tourIds.has(id)),
      cityIds:ids(v[p.cities]), day:typeof v[p.day]==='number' && v[p.day]>0 ? v[p.day] : null,
      session:names(v[p.session])[0] || ''};
  }).filter(p => p.name && (p.tourIds.length || linkedPlaceIds.has(p.id)));
  const c = TABLES.cities.fields;
  const linkedCities = new Set(places.flatMap(p=>p.cityIds));
  const cities = (raw.cities || []).filter(r=>linkedCities.has(r.id)).map(r=>{
    const v=cells(r), localNames=[text(v[c.nameTH]),text(v[c.nameEN]),text(v[c.nameCN])];
    const linkedPlaces=places.filter(p=>p.cityIds.includes(r.id));
    const coords=localNames.map(n=>coordsByName.get(n.toLocaleLowerCase())).find(Boolean) || null;
    return {id:r.id,name:localNames[0] || localNames[1] || text(v[c.displayName]),nameEN:localNames[1],countries:countryNames(v[c.countries]),
      coords, tourIds:uniq(linkedPlaces.flatMap(p=>p.tourIds)),placeIds:linkedPlaces.map(p=>p.id)};
  }).filter(c=>/[\p{L}\p{N}]/u.test(c.name));
  // Replace Airtable record IDs before data leaves the server.
  const publicTourIds=new Map(tours.map((t,i)=>[t.id,`tour-${i+1}`]));
  const publicPlaceIds=new Map(places.map((p,i)=>[p.id,`place-${i+1}`]));
  const publicCityIds=new Map(cities.map((c,i)=>[c.id,`city-${i+1}`]));
  const publicTours=tours.map(t=>({...t,id:publicTourIds.get(t.id),placeIds:t.placeIds.map(id=>publicPlaceIds.get(id)).filter(Boolean)}));
  const publicPlaces=places.map(p=>({...p,id:publicPlaceIds.get(p.id),tourIds:p.tourIds.map(id=>publicTourIds.get(id)).filter(Boolean),cityIds:p.cityIds.map(id=>publicCityIds.get(id)).filter(Boolean)}));
  const publicCities=cities.map(c=>({...c,id:publicCityIds.get(c.id),tourIds:c.tourIds.map(id=>publicTourIds.get(id)).filter(Boolean),placeIds:c.placeIds.map(id=>publicPlaceIds.get(id)).filter(Boolean)}));
  return {schemaVersion:1, source:'airtable', mode:'live', fetchedAt, tours:publicTours, places:publicPlaces, cities:publicCities,
    summary:{tourRecords:tours.length,areas:uniq(tours.flatMap(t=>t.countries)).length,places:places.length,cities:cities.length,mappedCities:cities.filter(c=>c.coords).length},
    mapNote:'หมุดแสดงพิกัดเมืองโดยประมาณจากตารางอ้างอิงเดิม ไม่ใช่เส้นทาง GPS'};
}

export async function fetchTravel({token,baseId,fetchImpl=fetch,signal}) {
  if (!/^app[A-Za-z0-9]{14}$/.test(baseId)) throw new Error('invalid_base');
  let lastRequest=0;
  async function readTable(table, recordIds) {
    if (recordIds && !recordIds.length) return [];
    let offset,records=[];
    do {
      // Stay below Airtable's per-base request limit within this refresh.
      const wait=220-(Date.now()-lastRequest);
      if(wait>0) await new Promise(r=>setTimeout(r,wait));
      const url=new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table.name)}`);
      url.searchParams.set('pageSize','100');
      Object.values(table.fields).forEach(f=>url.searchParams.append('fields[]',f));
      if(offset) url.searchParams.set('offset',offset);
      if(recordIds) url.searchParams.set('filterByFormula',`OR(${recordIds.map(id=>`RECORD_ID()='${id}'`).join(',')})`);
      lastRequest=Date.now();
      const response=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`},signal});
      if(!response.ok) throw new Error(`airtable_${response.status}`);
      const page=await response.json();
      if(!Array.isArray(page.records)) throw new Error('invalid_response');
      records.push(...page.records);offset=page.offset;
      if(records.length>5000) throw new Error('record_limit');
    } while(offset);
    return records;
  }
  const raw={};
  raw.tours=await readTable(TABLES.tours);
  raw.countries=await readTable(TABLES.countries);
  raw.places=await readTable(TABLES.places);
  const cityIds=uniq(raw.places.flatMap(r=>ids(cells(r)[TABLES.places.fields.cities])));
  raw.cities=[];
  for(let i=0;i<cityIds.length;i+=50) raw.cities.push(...await readTable(TABLES.cities,cityIds.slice(i,i+50)));
  return normalizeTravel(raw);
}
