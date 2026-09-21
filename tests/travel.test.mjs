import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTravel,fetchTravel,TABLES} from '../lib/travel-data.mjs';
import {createTravelService} from '../lib/travel-service.mjs';
const f=TABLES.tours.fields,p=TABLES.places.fields,c=TABLES.cities.fields;
const raw={
 tours:[{id:'recTour1',fields:{[f.name]:'<img src=x onerror=alert(1)> Test',[f.yearsCE]:['2000','2001'],[f.countries]:['recCountry1'],[f.places]:['recPlace1'],Price:999,Passport:'MUST_NOT_LEAK'}}],
 countries:[{id:'recCountry1',fields:{[TABLES.countries.fields.name]:'UK'}}],
 places:[{id:'recPlace1',fields:{[p.name]:'City walk',[p.cities]:['recCity1'],[p.tours]:['recTour1']}}],
 cities:[{id:'recCity1',fields:{[c.nameEN]:'London',[c.countries]:['recCountry1']}},{id:'recUnrelated',fields:{[c.nameEN]:'Paris'}}]
};
test('normalization retains multiple Buddhist years and omits sensitive/unrelated data',()=>{
 const data=normalizeTravel(raw,'2026-09-21T00:00:00Z');
 assert.deepEqual(data.tours[0].years,[2543,2544]);assert.deepEqual(data.tours[0].countries,['United Kingdom']);
 assert.equal(data.cities.length,1);assert.deepEqual(data.cities[0].coords,[51.5074,-0.1278]);
 assert.equal(data.places[0].tourIds[0],'tour-1');
 assert(!JSON.stringify(data).includes('MUST_NOT_LEAK'));assert(!JSON.stringify(data).includes('Price'));
});
test('missing configuration serves a dated snapshot and never calls upstream',async()=>{
 const service=createTravelService({env:{},load:()=>{throw new Error('must not run');}});
 const r=await service(new Request('https://example.test/api/travel'));const d=await r.json();
 assert.equal(r.status,200);assert.equal(d.mode,'snapshot');assert(d.fetchedAt);assert(d.tours.length>0);
 const denied=await service(new Request('https://example.test/api/travel',{method:'POST'}));assert.equal(denied.status,405);
});
test('successful fetches are cached; expired fetch failure is labeled stale without leaking the key',async()=>{
 let time=0,calls=0;
 const service=createTravelService({env:{AIRTABLE_TOKEN:'secret-test-token'},now:()=>time,load:async()=>{calls++;if(calls>1)throw new Error('secret-test-token');return normalizeTravel(raw);}});
 const request=()=>new Request('https://example.test/api/travel');
 assert.equal((await (await service(request())).json()).mode,'live');
 await service(request());assert.equal(calls,1);
 time=901000;const r=await service(request());const body=await r.text();assert.equal(JSON.parse(body).mode,'stale');assert(!body.includes('secret-test-token'));
 await service(request());assert.equal(calls,2);
});
test('cold-start authentication failure returns a snapshot without authentication error details',async()=>{
 const service=createTravelService({env:{AIRTABLE_TOKEN:'secret-test-token'},load:async()=>{throw new Error('401 secret-test-token');}});
 const r=await service(new Request('https://example.test/api/travel'));const body=await r.text();
 assert.equal(JSON.parse(body).mode,'snapshot');assert(!body.includes('secret-test-token'));assert(!body.includes('401'));
});
test('Airtable pagination follows offset and requests only approved public fields',async()=>{
 const seen=[];
 const result=await fetchTravel({token:'test-token',baseId:'appHeZT7AUmz2uHrw',fetchImpl:async(url,options)=>{
  seen.push(String(url));assert.equal(options.headers.Authorization,'Bearer test-token');
  const table=Object.values(TABLES).find(t=>decodeURIComponent(url.pathname).endsWith('/'+t.name));assert(table);
  assert.deepEqual(url.searchParams.getAll('fields[]'),Object.values(table.fields));
  const key=Object.keys(TABLES).find(k=>TABLES[k]===table);
  let payload={records:raw[key]};
  if(key==='tours'&&!url.searchParams.has('offset'))payload={records:[],offset:'cursor/one'};
  if(key==='cities')assert(url.searchParams.get('filterByFormula').includes("RECORD_ID()='recCity1'"));
  return new Response(JSON.stringify(payload),{status:200});
 }});
 assert.equal(result.tours.length,1);assert.equal(seen.length,5);assert(seen[1].includes('offset=cursor%2Fone'));
});
