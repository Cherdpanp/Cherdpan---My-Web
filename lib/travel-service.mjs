import { fetchTravel } from './travel-data.mjs';
import { readFileSync } from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('../public/data/travel-snapshot.json',import.meta.url),'utf8'));

export function createTravelService({env=process.env,load=fetchTravel,now=Date.now}={}) {
  let cached=null,expiry=0,pending=null;
  return async function handle(request) {
    const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
    if(request.method!=='GET') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{...headers,Allow:'GET'}});
    let result,cacheSeconds=60;
    if(!env.AIRTABLE_TOKEN) result={...snapshot,mode:'snapshot'};
    else if(cached && now()<expiry) {result=cached;cacheSeconds=900;}
    else {
      try {
        if(!pending) pending=load({token:env.AIRTABLE_TOKEN,baseId:env.AIRTABLE_BASE_ID||'appHeZT7AUmz2uHrw',signal:AbortSignal.timeout(25000)}).finally(()=>{pending=null;});
        cached=await pending;expiry=now()+900000;result=cached;cacheSeconds=900;
      } catch {
        // Never return upstream errors or authentication details to the browser.
        result=cached?{...cached,mode:'stale'}:{...snapshot,mode:'snapshot'};
        // Back off failed upstream attempts for one minute, including concurrent viewers.
        cached=result;expiry=now()+60000;
      }
    }
    if(result.mode!=='live') cacheSeconds=60;
    headers['Cache-Control']=`public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=60`;
    return new Response(JSON.stringify(result),{status:200,headers});
  };
}
