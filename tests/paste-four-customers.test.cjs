const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,p);
const {parseCustomerText}=require('../lib/paste-import.ts');
const map=JSON.parse(fs.readFileSync('public/data/wembley.json')),state={revision:0,buildings:[],customers:[],days:[]};
const raw=`Canvas Barnard Point-宗鸿-07700900001
Trevor 07700900002 Brookline
Andy，wembley arthur house， 7700 900003
scape, jamie, 07700900004`;
const rows=parseCustomerText(raw,state,map);
assert.equal(rows.length,4);
assert.deepEqual(rows.map(r=>r.name),['宗鸿','Trevor','Andy','jamie']);
assert.deepEqual(rows.map(r=>r.phone),['07700900001','07700900002','07700900003','07700900004']);
assert(rows.every(r=>r.locationConfirmed));
assert(rows.every(r=>r.note===''));
for(const phone of ['7700 900003','7700-900003','(7700) 900003','07700 900003','+44 7700 900003']){
 const batch=parseCustomerText(raw.replace('7700 900003',phone),state,map);
 assert.equal(batch.length,4,phone);assert.equal(batch[2].name,'Andy',phone);
 assert.equal(batch[3].name,'jamie',phone);
}
console.log('PASS four customers, compact hyphens, spaced UK mobiles, location and note isolation');
