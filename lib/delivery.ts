import type {Menu} from './menu-stats';
export type Place={id:string;name:string;address:string;lat:number;lng:number};
export type Customer={id:string;name:string;phone:string;buildingId:string;note:string};
export type Order={customerId:string;quantity:number};
export type Stop={building:Place;customers:(Customer&{quantity:number;delivered?:boolean;deliveredAt?:string})[];arrivalSeconds:number;walkSeconds:number;distance:number;completed:boolean;segmentGeometry?:number[][]};
export type Plan={stops:Stop[];geometry:number[][];walkSeconds:number;totalSeconds:number;distance:number;returnSeconds:number;algorithm:string;generatedAt:string};
export type Day={previousTrips?:Day[];needsReplan?:boolean;finishedAt?:string;walkMetres?:number;walkSamples?:number;walkGaps?:boolean;startedAt?:string;date:string;departure:string;originId:string;roundTrip:boolean;speed:number;orders:Order[];plan:Plan|null};
export type State={menus?:Menu[];buildings:Place[];customers:Customer[];days:Day[];revision:number};
export const emptyState:State={buildings:[],customers:[],days:[],revision:0};
export function localDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function newDay(date:string):Day{return {date,departure:'18:30',originId:'',roundTrip:false,speed:4.5,orders:[],plan:null};}
export function clockTime(departure:string,seconds:number){const [h,m]=departure.split(':').map(Number);const total=h*60+m+Math.round(seconds/60);return (total>=1440?'次日 ':'')+String(Math.floor(total/60)%24).padStart(2,'0')+':'+String(total%60).padStart(2,'0');}
export function notice(date:string,departure:string,stop:Stop,c:Customer,eta?:string){return c.name+'，您好！'+date+' 的餐食预计 '+(eta||clockTime(departure,stop.arrivalSeconds))+' 左右送到 '+stop.building.name+' 楼下，请到楼下交接。预计停留两分钟，实际时间可能略有变化。';}
export type MapData={bounds:{south:number;west:number;north:number;east:number};downloadedAt:string;features:{id:number;t:Record<string,string>;p:number[][]}[];nodes:number[][];edges:number[][]};
let promise:Promise<MapData>|undefined;
export function loadMap(){return promise??=fetch('/data/wembley.json?v=apartments-catalogue-4').then(r=>{if(!r.ok)throw new Error('离线地图加载失败，请刷新重试');return r.json() as Promise<MapData>;}).catch(e=>{promise=undefined;throw e;});}

export type PositionFix={lat:number;lng:number;accuracy:number;timestamp:number};
export type LiveRoute={stops:Stop[];geometry:number[][];totalSeconds:number;walkSeconds:number;distance:number;returnSeconds:number;baseAt:number};
export function pendingStops(plan:Plan):Stop[]{return plan.stops.filter(s=>!s.completed).map(s=>({...s,customers:s.customers.filter(c=>!c.delivered)})).filter(s=>s.customers.length>0);}
export function setDelivered(plan:Plan,customerId:string,delivered:boolean,at=new Date().toISOString()):Plan{return {...plan,stops:plan.stops.map(s=>{if(!s.customers.some(c=>c.id===customerId))return s;const customers=s.customers.map(c=>{const was=s.completed||!!c.delivered;return c.id===customerId?{...c,delivered,deliveredAt:delivered?at:undefined}:{...c,delivered:was};});return {...s,customers,completed:customers.every(c=>c.delivered)};})};}
export function liveTime(baseAt:number,seconds:number,date:string){const instant=new Date(baseAt+seconds*1000);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant);const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);return (local===date?'':local+' ')+time;}

export function startDelivery(day:Day,now=Date.now()):Day{if(day.startedAt)return day;if(day.date!==localDate()||!day.plan||!pendingStops(day.plan).length)throw new Error("请先规划今天的待送路线");return {...day,startedAt:new Date(now).toISOString(),departure:liveTime(now,0,day.date)};}
export function deliveryTime(day:Day,seconds:number){return day.startedAt?liveTime(Date.parse(day.startedAt),seconds,day.date):clockTime(day.departure,seconds);}

export function nextTrip(day:Day):Day{const {previousTrips,...snapshot}=day;return {...newDay(day.date),departure:clockTime(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}).format(Date.now()),0),originId:day.originId,speed:day.speed,roundTrip:day.roundTrip,previousTrips:[...(previousTrips||[]),snapshot]};}
export function completedStops(day:Day):Stop[]{return (day.plan?.stops||[]).map(s=>({...s,customers:s.customers.filter(c=>s.completed||c.delivered),completed:true})).filter(s=>s.customers.length>0);}
export function editTrip(day:Day,change:Partial<Day>):Day{
 let base=day;
 if(day.finishedAt){base=nextTrip(day);if(change.orders)change={...change,orders:change.orders.filter(o=>!day.orders.some(old=>old.customerId===o.customerId&&old.quantity===o.quantity))};}
 const done=completedStops(base).flatMap(s=>s.customers);if(change.orders&&done.some(c=>!change.orders!.some(o=>o.customerId===c.id&&o.quantity===c.quantity)))throw Error('已送达的份数已保留；请在下一趟添加同一顾客的新订单');
 return {...base,...change,needsReplan:true,plan:base.startedAt?base.plan:null};
}
