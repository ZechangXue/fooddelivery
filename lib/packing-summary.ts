import type {Customer,Day} from './delivery';

// Classify requests clause by clause so a negated drink request does not hide cash instructions.
export function packingRequest(note:string){
 const clauses=note.normalize('NFKC').split(/[，,;；。!！\n]|\s+[-–—]\s+/).map(s=>s.trim()).filter(Boolean);
 let drinks=false;const cash:string[]=[];
 for(const clause of clauses){
  const text=clause.replace(/\s+/g,' ');
  if(/(?:饮料|飲料|\bdrinks?\b|\bbeverages?\b)/i.test(text)&&!/(?:不带|不要|不用|无需|不需要|别带|免带|不喝|no\b|without\b|don't\b|do not\b).{0,12}(?:饮料|飲料|drinks?|beverages?)/i.test(text))drinks=true;
  const cashRequest=/现金|現金|\bcash\b|找零|(?:带|帶|备|備|准备|找|找回|找零).{0,16}(?:零钱|零錢|现金|現金|零钞|硬币)|(?:零钱|零錢|现金|現金).{0,8}(?:带|備|备)|\b(?:bring|need|prepare)\b.{0,24}\b(?:change|cash|coins)\b|\bchange\s+(?:for|of)\b/i.test(text);
  const negated=/(?:不用|不要|无需|不需要|别|不必|不|no\b|don't\b|do not\b).{0,12}(?:零钱|零錢|现金|現金|找零|change|cash|coins)/i.test(text);
  if(cashRequest&&!negated)cash.push(text);
 }
 // Keep the wording around amounts (e.g. “用 £20 找零”) instead of claiming it is the change owed.
 return {drinks,cashNote:cash.join('；')};
}
export function packingSummary(day:Day,customers:Customer[]){
 const drinks:{id:string;name:string;bottles:number}[]=[];let bottles=0;const cash=new Map<string,{id:string;name:string;note:string}>();
 for(const order of day.orders){
  const customer=customers.find(c=>c.id===order.customerId);if(!customer)continue;
  const request=packingRequest(customer.note||'');
  if(request.drinks){const count=Math.max(0,order.quantity);bottles+=count;if(count>0)drinks.push({id:customer.id,name:customer.name,bottles:count});}
  if(request.cashNote)cash.set(customer.id,{id:customer.id,name:customer.name,note:request.cashNote});
 }
 return {bottles,drinks,cash:[...cash.values()]};
}
