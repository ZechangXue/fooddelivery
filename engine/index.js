import {parseCustomerText,searchLocations} from '../lib/paste-import';
import {newDay,localDate,editTrip,nextTrip,startDelivery,setDelivered,pendingStops} from '../lib/delivery';
import {parseMenu,periodRange,summarize} from '../lib/menu-stats';
import {packingSummary} from '../lib/packing-summary';
import {buildingLabel} from '../lib/building-label';
import {advanceDistance} from '../lib/walking-distance';
import map from '../public/data/wembley.json';
async function request(path,body){
 const r=await fetch(path,{cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});
 if(r.status===401)throw Error('AUTH_REQUIRED');
 let d;try{d=await r.json();}catch{throw Error('数据服务暂时不可用');}
 if(!r.ok)throw Error(d.error||'请求失败');return d;
}
function calculate(input){return new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(new Blob([window.deliveryWorkerSource],{type:'text/javascript'})),worker=new Worker(url);
 const timer=setTimeout(()=>{worker.terminate();URL.revokeObjectURL(url);reject(Error('路线计算超时，请减少楼栋或重试'));},120000);
 const end=()=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);};
 worker.onmessage=e=>{if(e.data.progress)return;end();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};worker.onerror=()=>{end();reject(Error('路线计算失败'));};worker.postMessage({...input,map});
});}
export async function run(op,p={}){
 switch(op){
 case 'read':return request('/api/state');
 case 'save':return request('/api/state',p);
 case 'newDay':return newDay(p.date||localDate());
 case 'edit':return editTrip(p.day,p.change);
 case 'next':return nextTrip(p.day);
 case 'start':return startDelivery(p.day);
 case 'delivered':{let plan=p.day.plan;for(const id of p.ids)plan=setDelivered(plan,id,p.done);return {...p.day,plan};}
 case 'parse':return parseCustomerText(p.text,p.state,map);
 case 'locations':return searchLocations(p.text,p.state.buildings,map).map(x=>({...x.place,name:buildingLabel(x.place.name)}));
 case 'plan':return calculate(p);
 case 'remaining':return calculate({...p,mode:'remaining'});
 case 'packing':return packingSummary(p.day,p.state.customers);
 case 'menu':return parseMenu(p.text,p.date);
 case 'stats':{const range=periodRange(p.date,p.weeks||1);return {...range,...summarize(p.state,range.start,range.end,localDate())};}
 case 'distance':return advanceDistance(p.state,p.fix);
 case 'labels':return Object.fromEntries(p.state.buildings.map(b=>[b.id,buildingLabel(b.name)]));
 case 'tracking':{const config=await request('/api/tracking');const result=await request('/api/tracking',{position:p.position,live:p.live});return {...result,url:config.url};}
 default:throw Error('未知操作');
 }
}
window.deliveryEngine={run};
