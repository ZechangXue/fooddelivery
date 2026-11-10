import {editTrip,nextTrip} from './delivery';
import type {State,Place,Day,MapData,Customer} from './delivery';
export type ImportDraft={key:string;raw:string;name:string;phone:string;address:string;buildingName:string;quantity:number;note:string;customerId:string;buildingId:string;lat:number|null;lng:number|null;locationConfirmed:boolean;warnings:string[]};
export type ImportRow={name:string;phone:string;quantity:number;note:string;customerId:string;building:Place;locationConfirmed:boolean};
export function normalized(value:string){return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
export function phoneKey(value:string){let digits=value.replace(/\D/g,'');if(digits.startsWith('0044'))digits='0'+digits.slice(4);else if(digits.startsWith('44'))digits='0'+digits.slice(2);return digits;}
const phonePattern=/(?<!\d)(?:(?:\+44|0044)[\s()-]*(?:\(0\)[\s-]*)?(?:\d[\s()-]*){9}\d|0(?:[\s()-]*\d){9,10}|7(?:[ \t()-]*\d){9}|(?:\+?86[ -]*)?1[3-9]\d{9})(?!\d)/g;
function quantityNumber(value:string){if(/^\d+$/.test(value))return Number(value);const digits:Record<string,number>={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(value.includes('十')){const [a,b]=value.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}return digits[value]??NaN;}
function words(value:string){return value.normalize('NFKC').toLowerCase().replace(/&/g,' and ').replace(/\brd\b/g,'road').replace(/\bgarden\b/g,'gardens').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
function hasName(text:string,name:string){const n=words(name).replace(/^the /,'');return (' '+words(text)+' ').includes(' '+n+' ')&&!!n;}
export function groupNames(tags:Record<string,string>){return [...new Set([tags['delivery:group'],...(tags['delivery:group_aliases']||'').split(';')].filter(Boolean))];}
export function locationNames(tags:Record<string,string>){return [...new Set([tags.name,tags['addr:housename'],tags.alt_name,tags.short_name,tags['delivery:aliases']].filter(Boolean).flatMap(s=>s.split(';')).map(s=>s.trim()).filter(Boolean))];}
export function suggestLocations(text:string,buildings:Place[],map:MapData):{place:Place;existing:boolean;ambiguous?:boolean}[]{
 const candidates:{place:Place;existing:boolean;score:number}[]=[];const groups=new Set(map.features.flatMap(f=>groupNames(f.t)).map(words));
 const specificity=(name:string)=>/\b(house|heights|court|tower|apartments|lodge|east|west|south|north)\b/i.test(name)?100:0;
 for(const p of buildings)if(!groups.has(words(p.name))&&(hasName(text,p.name)||normalized(text)===normalized(p.address)))candidates.push({place:p,existing:true,score:1002+p.name.length+specificity(p.name)});
 for(const f of map.features){
  const name=f.t.name||f.t['addr:housename'];if(!name||!f.t.building||(groups.has(words(name))&&f.t['delivery:catalogue']!=='yes'))continue;
  const aliases=locationNames(f.t),matched=aliases.filter(n=>hasName(text,n)&&!groupNames(f.t).some(g=>words(g)===words(n))).sort((a,b)=>b.length-a.length)[0];
  const group=f.t['delivery:group'];const groupMatch=groupNames(f.t).some(g=>hasName(text,g));
  const street=f.t['addr:street'],number=f.t['addr:housenumber'],postcode=f.t['addr:postcode'];
  const addressMatch=!!street&&hasName(text,street)&&!!number&&hasName(text,number);
  const postcodeMatch=!!postcode&&normalized(text).includes(normalized(postcode));
  if(!matched&&!groupMatch&&!addressMatch)continue;
  const lat=f.p.reduce((s,p)=>s+p[1],0)/f.p.length,lng=f.p.reduce((s,p)=>s+p[0],0)/f.p.length;
  if(lat<51.542||lat>51.579||lng<-.309||lng>-.253)continue;
  const already=buildings.find(p=>normalized(p.name)===normalized(name)||aliases.some(a=>normalized(a)===normalized(p.name)));
  const score=matched?1000+matched.length+specificity(matched):addressMatch?800:groupMatch&&postcodeMatch?900:group!.length;
  candidates.push({place:already||{id:'',name,address:[name,number,street,postcode].filter(Boolean).join(', '),lat,lng},existing:!!already,score});
 }
 const seen=new Set<string>();const ranked=candidates.sort((a,b)=>b.score-a.score).filter(c=>{const key=normalized(c.place.name);if(seen.has(key))return false;seen.add(key);return true;});
 const ambiguous=ranked.length>1&&ranked[0].score===ranked[1].score;
 return ranked.map(({place,existing})=>({place,existing,ambiguous}));
}
// Extract handoff instructions before guessing names or addresses.
function extractNotes(input:string){
 const notes:string[]=[];
 const explicit=input.match(/(?:备注|notes?|instructions?)\s*[:：]\s*(.*)$/i);
 if(explicit){notes.push(explicit[1].trim());input=input.slice(0,explicit.index);}
 const parts=input.split(/[,，;；|]|\s+[-—–]\s+|[—–]/);
 const rest=parts.map(part=>{
  part=part.trim().replace(/^[-—–]+\s*|\s*[-—–]+$/g,'');
  const match=part.match(/(?:带零钱|带现金|带点零钱|带点现金|带些零钱|准备零钱|找零|单点|带饮料|饮料零食|饮料|微信联系|联系微信|按门铃|多蔬菜|多萝卜|米饭|锅包肉)|(?:请)?(?:放到?|放在|放进|送到|送至|留在|存放|交给|交到|不要按|别按|不要打|不用打|到了|到后|到达后|到楼下|打电话|发短信|联系我)|(?:只会|只说|会说|说|用)?(?:英语|英文|中文)(?![\p{L}])|(?:现金|已付款|已付|转账|刷卡|货到付款)|\b(?:please\s+)?(?:leave|put|drop|place)\s+(?:it\s+|the\s+(?:food|order)\s+)?(?:in|at|outside|by|into|inside|with)\b|\b(?:speak(?:s)?\s+English|English\s+only|cash(?:\s+only|\s+payment|\s+on\s+delivery)?|paid|call\s+(?:me|on\s+arrival)|text\s+me|do\s+not\s+(?:ring|call)|don't\s+(?:ring|call))\b|(?:月饼|月餅|\bmoon\s*cakes?\b)|^[\s\p{Extended_Pictographic}\uFE0F\u200D]+$|^(?:英文|英语|中文|English)$/iu);
  if(!match)return part;
  notes.push(part.slice(match.index).trim());
  return part.slice(0,match.index).trim();
 }).filter(x=>x.trim());
 return {rest:rest.join(', '),note:notes.filter(Boolean).join('；')};
}



function editDistance(a:string,b:string){const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return d[b.length];}
function correctCompactAddress(text:string,map:MapData,warnings:string[]){
 const aliases=[...new Set(map.features.filter(f=>f.t.building).flatMap(f=>locationNames(f.t)))].filter(a=>/\b(house|court)\b/i.test(a));
 return text.replace(/\b[a-z]{7,}(?:house|court)\b/gi,token=>{const options=aliases.map(a=>({a,d:editDistance(normalized(token),normalized(a))})).filter(x=>x.d<=1).sort((a,b)=>a.d-b.d);const names=[...new Set(options.filter(x=>x.d===options[0]?.d).map(x=>normalized(x.a)))];if(names.length!==1)return token;const match=options[0];warnings.push('楼名拼写已匹配为 '+match.a+'，请核对');return match.a;});
}

// A phone is a record anchor, not a line boundary: keep address/name lines with it.
export function splitCustomerMessages(input:string,standalone:(line:string)=>boolean=()=>false):string[]{
 const clean=input.split('\n').filter(line=>!/^\s*(?:(?:.{1,60}\s+)?\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?|(?:昨天|今天|前天|星期[一二三四五六日天])?\s*\d{1,2}:\d{2})\s*$/.test(line)).join('\n');
 return clean.split(/\n\s*\n/).flatMap(block=>{
  const rows:string[]=[],lines=block.split('\n').map(s=>s.trim()).filter(Boolean);
  let current:string[]=[],next:string[]=[],hasPhone=false;
  for(const line of lines){
   const phones=line.match(phonePattern)||[];
   if(!phones.length&&standalone(line)){if(current.length||next.length)rows.push([...current,...next].join(', '));rows.push(line);current=[];next=[];hasPhone=false;continue;}
   if(phones.length&&hasPhone){rows.push(current.join(', '));current=[...next,line];next=[];}
   else if(hasPhone){
    const noteOnly=!extractNotes(line).rest.replace(/[-—–\s,，;；]/g,'');
    const addressContinuation=/^(?:地址|address)\s*[:：]/i.test(line)&&!/(?:地址|\baddress\b|\bhouse\b|\bgardens?\b|\broad\b|\bway\b|\blandsby\b|\bferrum\b|\bscape\b|\brobinson\b)/i.test(current.join(' '));
    if(!next.length&&(addressContinuation||noteOnly||/^(?:备注|邮编|份数|数量|电话|手机|postcode|notes?)\s*[:：]/i.test(line)))current.push(line);
    else next.push(line);
   }else current.push(line);
   if(phones.length)hasPhone=true;
  }
  if(current.length||next.length)rows.push([...current,...next].join(', '));
  return rows.filter(Boolean);
 });
}

/** WeChat multi-select copies sender labels on a separate colon-terminated line. */
export function stripWeChatHeaders(input:string){
 return input.split('\n').filter(line=>{
  const text=line.trim();
  if(!/[:：]$/.test(text))return true;
  if(/^(?:姓名|名字|客户|地址|电话|手机|备注|邮编|数量|份数|name|address|phone|tel|notes?|postcode)\s*[:：]$/i.test(text))return true;
  return !(/^[^\n:：]{1,80}[:：]$/.test(text));
 }).join('\n');
}

export function parseCustomerText(input:string,state:State,map:MapData):ImportDraft[]{
 const normalizedInput=stripWeChatHeaders(input.normalize('NFKC').replace(/\r/g,'')).trim();if(!normalizedInput)throw new Error('请先粘贴顾客信息');
 if(normalizedInput.length>15000)throw new Error('一次最多粘贴 15000 个字，请分批导入');
 const chunks=splitCustomerMessages(normalizedInput,line=>{
 const clean=extractNotes(correctCompactAddress(line,map,[])).rest;
 const address=suggestLocations(clean,state.buildings,map);
 if(!address.length)return false;
 let remainder=clean;for(const alias of map.features.filter(f=>f.t.building).flatMap(f=>[...locationNames(f.t),...groupNames(f.t)]).sort((a,b)=>b.length-a.length))remainder=remainder.replace(new RegExp(alias.replace(/[.*+?^{}$()|[\]\\]/g,'\\const chunks=splitCustomerMessages(normalizedInput);'),'gi'),' ');
 return /[\p{L}]/u.test(remainder.replace(/[-+,;\s]/g,''))&&!/\b(flat|road|rd|way|walk|gardens?|wembley)\b|\d{2}|邮编/i.test(remainder);
 });
 if(chunks.length>25)throw new Error('一次最多识别 25 位顾客，请分批粘贴');
 return chunks.map((raw,index)=>{
  const warnings:string[]=[];let rest=raw.replace(/^\s*\d+[.)、]\s*/,'');const phones=rest.match(phonePattern)||[];let phone=phones[0]?.replace(/[^+\d]/g,'')||'';if(/^7\d{9}$/.test(phone)){phone='0'+phone;warnings.push('英国手机号已补开头 0，请核对');}if(!phone)warnings.push('未识别到电话，请补充或核对');if(/^0\d{9}$/.test(phone))warnings.push('电话号码位数不足，请核对；未猜补数字');if(phones.length>1)warnings.push('这一条有多个电话号码，请拆成每人一条');
  rest=rest.replace(phonePattern,' ');
  rest=correctCompactAddress(rest,map,warnings);
  const addressInput=rest;
  const unresolvedFerrum=rest.match(/\bferrum\s*(\d{2,})\b/i);
  if(unresolvedFerrum)warnings.push('Ferrum 后的数字可能包含房号，请确认具体楼栋；原文已保留');
  const single=/单点/.test(rest);
  const box=rest.match(/盒饭\s*([\d一二两三四五六七八九十]+)\s*(?:份|盒)?|([\d一二两三四五六七八九十]+)\s*(?:份|盒)\s*盒饭/);
  const q=box||(!single?rest.match(/([\d一二两三四五六七八九十]+)\s*(?:份|盒|餐|meals?\b|portions?\b)|(?:\bx|×)\s*(\d{1,2})\b|[-—–]\s*(\d{1,2})\s*$/i):null);
  let quantity=q?quantityNumber(q[1]||q[2]||q[3]):single?0:1;
  if(!q)warnings.push(single?'纯单点，盒饭记为 0 盒；仍参与配送':'未识别到份数，暂按 1 盒');
  if(!Number.isInteger(quantity)||quantity<0||quantity>99){quantity=single?0:1;warnings.push('盒饭份数无法确认，请核对');}
  // Preserve complete dish text and quantities in notes before removing box counts.
  const extracted=extractNotes(rest);rest=extracted.rest;let note=extracted.note;
  if(q)rest=rest.replace(q[0],' ');
  const nameMatch=rest.match(/(?:姓名|名字|客户|name)\s*(?:[:：]|是)\s*([^,，;；]+)/i);
  let name=nameMatch?.[1]?.trim()||'';if(nameMatch)rest=rest.replace(nameMatch[0],' ');
  rest=rest.replace(/(?:电话|手机|联系方式|phone|tel|数量|份数|quantity)\s*[:：]?/gi,' ').replace(/(?:地址|address)\s*[:：]/gi,' ');
  const addressRemainder=rest;
  // Reserve known address phrases before extracting a person's name, including mixed WeChat text.
  const addressNames=[...state.buildings.map(p=>p.name),...map.features.filter(f=>f.t.building).flatMap(f=>[...locationNames(f.t),...groupNames(f.t)])].filter(Boolean).flatMap(n=>[n,n.replace(/^The /i,'')]).flatMap(n=>[n,n.replace(/\bGardens\b/gi,'Garden')]).sort((a,b)=>b.length-a.length);
  const reserved:string[]=[];
  if(unresolvedFerrum){reserved.push(unresolvedFerrum[0]);rest=rest.replace(unresolvedFerrum[0],' ');}
  rest=rest.replace(/\bcanvas\s+students?\b/gi,'Canvas');
  for(const alias of [...new Set(addressNames)]){
   const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
   const pattern=new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'(?![\\p{L}\\p{N}])','giu');
   rest=rest.replace(pattern,match=>{reserved.push(match);return ' ';});
  }
  rest=rest.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi,' ');
  const tokens=rest.split(/[+,，;；|]/).map(t=>t.trim().replace(/^[-—–\s]+|[-—–\s]+$/g,'')).filter(Boolean);
  const locs=unresolvedFerrum?[]:suggestLocations(addressInput,state.buildings,map);
  const looksAddress=(t:string)=>/\b(house|gardens|road|street|lane|way|heights|court|tower|apartments|lodge|avenue|boulevard|park|drive|close|walk|place|flat|floor|building|wembley|ferrum|landsby|robinson|scape|sterling)\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|公寓|街|路|楼|栋|邮编|postcode/i.test(t)||/^\d/.test(t)||locs.some(p=>normalized(t)===normalized(p.place.name));
  if(!name){const candidates=tokens.filter(t=>!looksAddress(t));if(candidates.length){name=candidates[0];tokens.splice(tokens.lastIndexOf(name),1);if(candidates.length>1)warnings.push('姓名与地址顺序不明确，请核对');}}
  const extra=tokens.filter(t=>!looksAddress(t));if(extra.length)note=[...extra,note].filter(Boolean).join('；');
  let addressText=addressRemainder;
  for(const part of [name,...extra].filter(Boolean)){const at=addressText.indexOf(part);if(at>=0)addressText=addressText.slice(0,at)+addressText.slice(at+part.length);}
  const address=addressText.split(/[+,，;；|]/).map(t=>t.trim().replace(/^[-—–\s]+|[-—–\s]+$/g,'')).filter(Boolean).join(', ');

  let existing:Customer|undefined;const matches=phone?state.customers.filter(c=>phoneKey(c.phone)===phoneKey(phone)):[];
  if(matches.length===1){existing=matches[0];if(name&&normalized(name)!==normalized(existing.name)){note=[name,note].filter(Boolean).join('；');warnings.push('按唯一电话号码匹配常客；原文中的其他称呼已保留为备注，请核对');}name=existing.name;}
  if(matches.length&&!existing)warnings.push('这个号码已有顾客档案，请选择对应顾客或确认是新顾客');
  if(!existing&&name&&!phone&&locs[0]?.existing){const byName=state.customers.filter(c=>normalized(c.name)===normalized(name)&&c.buildingId===locs[0].place.id);if(byName.length===1)existing=byName[0];}
  const existingPlace=existing?state.buildings.find(p=>p.id===existing!.buildingId):undefined;
  const selected=unresolvedFerrum?undefined:(locs[0]?.ambiguous?undefined:locs[0])||(existingPlace?{place:existingPlace,existing:true}:undefined);
  if(!selected&&!locs.length&&!unresolvedFerrum)warnings.push('地址文字已识别，但离线楼栋库未匹配到位置，请选择或标记入口');
  if(locs[0]?.ambiguous)warnings.push('此名称对应多栋楼，请在下面选择具体楼栋');
  if(locs.length>1&&normalized(locs[0].place.name)!==normalized(locs[1].place.name))warnings.push('地址中匹配到多个楼名，请核对选中的交接楼栋');
  if(!name&&existing)name=existing.name;if(!name)warnings.push('未识别到姓名，请补充');
  if(existingPlace&&selected&&selected.place.id!==existingPlace.id)warnings.push('地址与常客档案不同，确认后将更新该顾客楼栋');
  return {key:'row-'+index,raw,name,phone:phone||existing?.phone||'',address:address||selected?.place.address||'',buildingName:selected?.place.name||address,quantity,note,customerId:existing?.id||'',buildingId:selected?.existing?selected.place.id:'',lat:selected?.place.lat??null,lng:selected?.place.lng??null,locationConfirmed:!!selected,warnings};
 });
}
export function applyCustomerImport(state:State,rows:ImportRow[],selectedDay:Day,addToDay:boolean):State{
 const next:State={...state,buildings:state.buildings.map(p=>({...p})),customers:state.customers.map(c=>({...c})),days:[...state.days]};
 const storedDay=state.days.find(d=>d.date===selectedDay.date);
 if(addToDay&&selectedDay.finishedAt)selectedDay=nextTrip(selectedDay);
 const orders=selectedDay.orders.map(o=>({...o}));const seen=new Set<string>();
 for(const row of rows){
  if(!row.locationConfirmed)throw new Error('请先确认新楼栋的交接位置');
  let building=next.buildings.find(p=>p.id===row.building.id);if(building&&!state.buildings.some(p=>p.id===building!.id)&&(normalized(building.name)!==normalized(row.building.name)||Math.abs(building.lat-row.building.lat)+Math.abs(building.lng-row.building.lng)>.0004))throw new Error('同一新楼栋的入口信息不一致，请核对后保存');
  if(!building){const named=next.buildings.find(p=>normalized(p.name)===normalized(row.building.name));if(named){if(normalized(named.address)!==normalized(row.building.address)&&Math.abs(named.lat-row.building.lat)+Math.abs(named.lng-row.building.lng)>.0004)throw new Error('已有同名楼栋，请从已有楼栋中选择，避免重复地址');building=named;}else{building={...row.building};next.buildings.push(building);}}
  let c=row.customerId?next.customers.find(c=>c.id===row.customerId):undefined;if(row.customerId&&!c)throw new Error('所选顾客已不存在，请重新识别');
  if(!c){const matches=next.customers.filter(c=>normalized(c.name)===normalized(row.name)&&(row.phone?phoneKey(c.phone)===phoneKey(row.phone):c.buildingId===building!.id));if(matches.length===1)c=matches[0];}
  const customer={id:c?.id||crypto.randomUUID(),name:row.name,phone:row.phone,buildingId:building.id,note:row.note};
  if(seen.has(customer.id))throw new Error('粘贴内容里有重复顾客，请移除重复的一条后保存');seen.add(customer.id);
  if(c)next.customers=next.customers.map(x=>x.id===c!.id?customer:x);else next.customers.push(customer);
  if(addToDay){const order=orders.find(o=>o.customerId===customer.id);if(order)order.quantity=row.quantity;else orders.push({customerId:customer.id,quantity:row.quantity});}
 }
 if(addToDay){if(orders.length>25)throw new Error('加入后超过 25 位顾客，请减少本次导入人数');const d=editTrip(selectedDay,{orders});next.days=[d,...next.days.filter(x=>x.date!==d.date)].sort((a,b)=>b.date.localeCompare(a.date));}
 return next;
}

export function searchLocations(text:string,buildings:Place[],map:MapData){
 const exact=suggestLocations(text,buildings,map);const q=words(text);if(!q)return [];
 const extra=map.features.filter(f=>f.t.building&&[...locationNames(f.t),...groupNames(f.t),[f.t['addr:housenumber'],f.t['addr:street'],f.t['addr:postcode']].filter(Boolean).join(' ')].some(v=>words(v).includes(q))).flatMap(f=>suggestLocations(f.t.name||f.t['addr:housename']||'',buildings,map));
 const seen=new Set<string>();return [...exact,...extra].filter(x=>{const k=normalized(x.place.name);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,30);
}
