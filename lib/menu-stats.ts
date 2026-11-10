import type {State,Day} from './delivery';
export type Dish={name:string;kind:'meat'|'vegetable'|'other'};
export type Menu={date:string;raw:string;dishes:Dish[]};
export function dishKey(s:string){return s.normalize('NFKC').toLowerCase().replace(/[\s，,。.!！·]/g,'');}
export function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function addDays(date:string,count:number){return new Date(Date.parse(date+'T12:00:00Z')+count*86400000).toISOString().slice(0,10);}
export function periodRange(anchor:string,weeks:1|4){const weekday=new Date(anchor+'T12:00:00Z').getUTCDay();const monday=addDays(anchor,-((weekday+6)%7));return {start:addDays(monday,-7*(weeks-1)),end:addDays(monday,6)};}
export function parseMenu(raw:string,selectedDate:string):Menu{
 if(!raw.trim())throw Error('请先粘贴当天菜单');
 let text=raw.normalize('NFKC').replace(/\r/g,'');let date=selectedDate;
 const dateMatch=text.match(/(?:(20\d{2})[年./-])?(\d{1,2})[月./-](\d{1,2})(?:日|号)?/);
 if(dateMatch){date=(dateMatch[1]||selectedDate.slice(0,4))+'-'+dateMatch[2].padStart(2,'0')+'-'+dateMatch[3].padStart(2,'0');if(!validDate(date))throw Error('菜单日期无效，请检查原文');text=text.replace(dateMatch[0],'');}
 text=text.replace(/(?:周|星期)[一二三四五六日天]/g,'').replace(/(?:今日|当天|明日)?(?:盒饭菜品|盒饭菜单|盒饭|菜品|菜单)\s*[:：]?/g,'').replace(/[⬇↓️]/g,'');
 const orderedRule=/前(?:两|二|2)个.*肉菜.*第三个.*素菜/.test(text);
 text=text.replace(/\([^)]*\)/g,part=>/肉菜|素菜|荤菜|前两|前二|前2|第三/.test(part)?'':part);
 const parts=text.split(/[+\n；;、]/).map(s=>s.trim().replace(/^[\-•●\d.、\s]+/,'')).filter(Boolean);
 const dishes:Dish[]=parts.map((part,index)=>{
  const explicitMeat=/^(?:肉菜|荤菜)\s*[:：]/.test(part),explicitVeg=/^素菜\s*[:：]/.test(part);
  const name=part.replace(/^(?:肉菜|荤菜|素菜|其他)\s*[:：]/,'').trim();
  let kind:Dish['kind']='other';
  if(explicitMeat)kind='meat';else if(explicitVeg)kind='vegetable';
  else if(orderedRule)kind=index<2?'meat':'vegetable';
  else if(/肉|排骨|鸡|鸭|鹅|牛|羊|猪|鱼|虾|蟹|腊肠|香肠|培根|肥肠|肚|蹄|丸子/.test(name))kind='meat';
  else if(/蛋|豆腐|西葫芦|青菜|白菜|土豆|茄子|番茄|西红柿|黄瓜|菠菜|花菜|包菜|藕|笋|菌|菇|豆角|生菜/.test(name))kind='vegetable';
  return {name,kind};
 }).filter(d=>d.name);
 if(!dishes.length)throw Error('没有识别到菜品，请直接填写菜名');
 if(dishes.length>20)throw Error('一天最多保存 20 道菜，请移除菜单以外的文字');
 return {date,raw,dishes};
}
export function summarize(state:State,start:string,end:string,today:string){
 const menus=new Map((state.menus||[]).map(m=>[m.date,m]));
 const people=new Map<string,{id:string;name:string;phone:string;boxes:number;days:number;lastDate:string}>();
 const dishes=new Map<string,{name:string;boxes:number;days:number}>();
 let boxes=0,orderDays=0,coveredBoxes=0;const missing:{date:string;boxes:number}[]=[];
 const days=state.days.filter(d=>d.date>=start&&d.date<=end&&d.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 for(const original of days){const combined=new Map<string,number>();for(const trip of [...(original.previousTrips||[]),original])for(const o of trip.orders)combined.set(o.customerId,(combined.get(o.customerId)||0)+o.quantity);const day={...original,orders:[...combined].map(([customerId,quantity])=>({customerId,quantity}))};const total=day.orders.reduce((s,o)=>s+o.quantity,0);if(!day.orders.length)continue;boxes+=total;orderDays++;
  for(const order of day.orders){const archive=state.customers.find(c=>c.id===order.customerId),snapshot=day.plan?.stops.flatMap(s=>s.customers).find(c=>c.id===order.customerId);const c=archive||snapshot;
   const row=people.get(order.customerId)||{id:order.customerId,name:c?.name||'已删除顾客',phone:c?.phone||'',boxes:0,days:0,lastDate:day.date};
   row.boxes+=order.quantity;row.days++;row.lastDate=day.date;people.set(row.id,row);
  }
  if(total===0)continue;
  const menu=menus.get(day.date);if(!menu?.dishes.length){missing.push({date:day.date,boxes:total});continue;}
  coveredBoxes+=total;const seen=new Set<string>();
  for(const dish of menu.dishes){if(dish.kind!=='meat')continue;const key=dishKey(dish.name);if(seen.has(key))continue;seen.add(key);const row=dishes.get(key)||{name:dish.name,boxes:0,days:0};row.boxes+=total;row.days++;dishes.set(key,row);}
 }
 return {boxes,orderDays,coveredBoxes,missing,customers:[...people.values()].sort((a,b)=>b.boxes-a.boxes||b.days-a.days||a.name.localeCompare(b.name)),meats:[...dishes.values()].sort((a,b)=>b.boxes-a.boxes||b.days-a.days||a.name.localeCompare(b.name))};
}
