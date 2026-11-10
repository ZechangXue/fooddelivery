const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,p);
const {parseCustomerText}=require('../lib/paste-import.ts');const raw=`Merevale House - 07700900001 - WNY
Trevor 07700900002 Brookline
ferrum 3 ， pika， 07700900003
07700900004 - flat 147，581 north end rd，冉冉，按门铃就好
Birch house, 杨文君，7700900005
Ferrum361 Jialu 07700900006 - 多蔬菜多萝卜 - 米饭半份 - 锅包肉小格子
812 Landsby West, 10 Elvin gardens, HA9 0GW - haozhi Liu - 07700900007
Aurthurhouse - 微信联系 - Garfield
pavilion court - 07700900008 - 咖啡猫
Sterling court-IQ 苗苗 07700900009 - 饮料零食
canvas student - Arthur House - 07700900010 - zo_0z
fulton&fifth Raven 0730000000 - 饮料
luna - 07700900011 - Cecilia
Unite Students Yuan 07700900012 - HA9 0FR`;
const rows=parseCustomerText(raw,{revision:0,buildings:[],customers:[],days:[]},JSON.parse(fs.readFileSync('public/data/wembley.json')));
assert.equal(rows.length,14);
assert.deepEqual(rows.map(r=>r.name),['WNY','Trevor','pika','冉冉','杨文君','Jialu','haozhi Liu','Garfield','咖啡猫','苗苗','zo_0z','Raven','Cecilia','Yuan']);
assert(rows.every(r=>r.quantity===1));
assert.equal(rows[3].note,'按门铃就好');assert.equal(rows[3].address,'flat 147, 581 north end rd');
assert.equal(rows[5].note,'多蔬菜多萝卜；米饭半份；锅包肉小格子');assert.equal(rows[5].address,'Ferrum361');assert.equal(rows[5].locationConfirmed,false);
assert.equal(rows[6].address,'812 Landsby West, 10 Elvin gardens, HA9 0GW');
assert.equal(rows[7].phone,'');assert.equal(rows[7].note,'微信联系');assert.equal(rows[7].buildingName,'Canvas - Arthur House');
assert.equal(rows[9].note,'饮料零食');assert.equal(rows[11].note,'饮料');assert(rows[11].warnings.some(w=>w.includes('位数不足')));
assert.equal(rows[13].buildingName,'Unite Students - Olympic Way');assert(rows[13].locationConfirmed);
console.log('PASS all 14 records: names, notes, addresses, ambiguity, missing phone, postcode disambiguation');
