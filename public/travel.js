const $=id=>document.getElementById(id);
let data=null,map=null,markers=null;
const state={query:'',year:'',country:''};
function node(tag,text,className){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;}
function formatYears(years){return years.length?years.join(' / '):'ไม่ระบุปี';}
function dateLabel(value){const date=new Date(value);return Number.isNaN(date.valueOf())?'':date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'});}
function option(label,value){const o=node('option',label);o.value=value;return o;}
function tourSearch(t){const places=data.places.filter(p=>p.tourIds.includes(t.id));const cities=data.cities.filter(c=>c.tourIds.includes(t.id));return [t.name,...t.countries,...places.map(p=>p.name),...cities.flatMap(c=>[c.name,c.nameEN])].join(' ').toLocaleLowerCase();}
function visibleTours(){return data.tours.filter(t=>(!state.year||t.years.includes(Number(state.year)))&&(!state.country||(state.country==='__unknown__'?!t.countries.length:t.countries.includes(state.country)))&&(!state.query||tourSearch(t).includes(state.query)));}
function mapLink(city){const link=node('a','ดูตำแหน่งใน Google Maps ↗');link.target='_blank';link.rel='noopener noreferrer';link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([city.nameEN||city.name,...city.countries].join(', '));return link;}
function initMap(){
 if(!window.L){$('travel-map').append(node('p','โหลดแผนที่ไม่ได้ในขณะนี้ ยังค้นหาและดูรายการเดินทางด้านล่างได้ครับ','travel-map-notice'));return;}
 map=L.map('travel-map',{scrollWheelZoom:false}).setView([25,45],2);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 markers=L.featureGroup().addTo(map);
}
function renderMap(tours){
 const ids=new Set(tours.map(t=>t.id));const cities=data.cities.filter(c=>c.tourIds.some(id=>ids.has(id)));const positioned=cities.filter(c=>c.coords);
 $('map-note').textContent=`${positioned.length} หมุด จาก ${cities.length} เมือง • พิกัดเมืองโดยประมาณ ไม่ใช่เส้นทาง GPS`;
 if(!map)return;markers.clearLayers();
 positioned.forEach(city=>{
  const popup=node('div');popup.append(node('h3',city.name),node('p',city.countries.join(' · ')));
  const list=node('ul');tours.filter(t=>city.tourIds.includes(t.id)).forEach(t=>list.append(node('li',`${t.name} · พ.ศ. ${formatYears(t.years)}`)));
  popup.append(list,mapLink(city));
  L.circleMarker(city.coords,{radius:7,color:'#fff2d2',weight:2,fillColor:'#8669dc',fillOpacity:.95}).bindPopup(popup,{maxWidth:310}).addTo(markers);
 });
 if(positioned.length) map.fitBounds(markers.getBounds(),{padding:[28,28],maxZoom:6,animate:false});
}
function render(){
 const tours=visibleTours();const list=$('travel-list');list.replaceChildren();
 $('travel-results').textContent=`แสดง ${tours.length} จาก ${data.tours.length} รายการเดินทาง`;
 if(!tours.length)list.append(node('p','ไม่พบรายการที่ตรงกัน ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง','travel-empty'));
 tours.forEach(t=>{
  const details=node('details',null,'travel-tour');const summary=node('summary');summary.append(node('span',formatYears(t.years),'year'));
  const title=node('span',t.name,'travel-tour-title');const places=data.places.filter(p=>p.tourIds.includes(t.id));
  title.append(node('span',`${t.countries.join(' · ')||'ยังไม่ระบุประเทศ/พื้นที่'} · ${places.length} สถานที่/กิจกรรม`,'travel-tour-meta'));
  summary.append(title,node('span','+','travel-tour-toggle'));const body=node('div',null,'travel-tour-body');
  if(places.length){const ol=node('ol');places.slice().sort((a,b)=>(a.day??999)-(b.day??999)).forEach(p=>{
   const item=node('li',(p.day?`วันที่ ${p.day} · `:'')+p.name);const cities=data.cities.filter(c=>p.cityIds.includes(c.id));
   if(cities.length)item.append(node('span',' — '+cities.map(c=>c.name).join(' / ')));ol.append(item);
  });body.append(ol);}else body.append(node('p','ยังไม่มีสถานที่หรือกิจกรรมเชื่อมกับรายการนี้'));
  details.append(summary,body);list.append(details);
 });
 renderMap(tours);
}
async function boot(){
 try {
  let response=await fetch('/api/travel',{signal:AbortSignal.timeout(30000)}).catch(()=>null);
  if(response?.ok){try{data=await response.json();}catch{data=null;}}
  if(!data?.tours){response=await fetch('/data/travel-snapshot.json');if(!response.ok)throw new Error('no_data');data=await response.json();data.mode='snapshot';}
  if(!Array.isArray(data.tours)||!Array.isArray(data.cities)||!Array.isArray(data.places))throw new Error('invalid_data');
  const status=$('travel-status');status.dataset.mode=data.mode;
  status.textContent=(data.mode==='live'?'ข้อมูลจาก Airtable':data.mode==='stale'?'ข้อมูลล่าสุดที่โหลดสำเร็จ':'ข้อมูลที่บันทึกจาก Airtable')+' · '+dateLabel(data.fetchedAt)+(data.mode==='live'?' · อัปเดตเมื่อเปิดหน้าเว็บ โดยใช้แคชประมาณ 15 นาที':'');
  $('stat-tours').textContent=data.summary.tourRecords;$('stat-areas').textContent=data.summary.areas;$('stat-places').textContent=data.summary.places;$('stat-cities').textContent=data.summary.cities;
  [...new Set(data.tours.flatMap(t=>t.years))].sort((a,b)=>b-a).forEach(y=>$('travel-year').append(option('พ.ศ. '+y,String(y))));
  [...new Set(data.tours.flatMap(t=>t.countries))].sort().forEach(c=>$('travel-country').append(option(c,c)));
  if(data.tours.some(t=>!t.countries.length))$('travel-country').append(option('ยังไม่ระบุประเทศ/พื้นที่','__unknown__'));
  $('travel-search').addEventListener('input',e=>{state.query=e.target.value.trim().toLocaleLowerCase();render();});
  $('travel-year').addEventListener('change',e=>{state.year=e.target.value;render();});
  $('travel-country').addEventListener('change',e=>{state.country=e.target.value;render();});
  $('travel-reset').addEventListener('click',()=>{Object.keys(state).forEach(k=>state[k]='');['travel-search','travel-year','travel-country'].forEach(id=>$(id).value='');render();});
  initMap();render();
 }catch{
  $('travel-status').textContent='โหลดข้อมูลไม่ได้ในขณะนี้ กรุณารีเฟรชหน้าเว็บอีกครั้ง';
  $('travel-list').append(node('p','กรุณาลองใหม่ภายหลัง','travel-empty'));
 }
}
boot();
