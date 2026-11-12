const fs=require('fs'),ts=require('typescript'),a=require('node:assert/strict');require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,p);
const {packingRequest:p,packingSummary:s}=require('../lib/packing-summary.ts');
a.equal(p('带饮料；带零钱 £10').drinks,true);a.equal(p('不要带饮料；带零钱 £10').drinks,false);a.equal(p('不用带零钱').cashNote,'');a.equal(p('现金支付').cashNote,'现金支付');a.equal(p('please bring change for £20').cashNote,'please bring change for £20');
const customers=[{id:'a',name:'甲',note:'带饮料；带零钱10镑'},{id:'b',name:'乙',note:'饮料；带现金'},{id:'c',name:'丙',note:'不带饮料；不用带零钱'}];
const summary=s({orders:[{customerId:'a',quantity:2},{customerId:'b',quantity:1},{customerId:'c',quantity:3}]},customers);a.equal(summary.bottles,3);a.equal(summary.cash.length,2);a.equal(summary.cash[0].note,'带零钱10镑');
const {parseCustomerText}=require('../lib/paste-import.ts');const row=parseCustomerText('Trevor Brookline 07700900001 - 带零钱20镑 - 带饮料',{buildings:[],customers:[],days:[]},JSON.parse(fs.readFileSync('public/data/wembley.json')))[0];a.equal(row.name,'Trevor');a(row.note.includes('带零钱20镑'));console.log('PASS packing counts, cash requests, negation, amounts and paste extraction');

for(const note of ['现金','現金','cash','现金支付','现金(带7镑零钱)'])a.equal(p(note).cashNote,note);
for(const note of ['不用现金','不要带现金','不需要零钱','no cash'])a.equal(p(note).cashNote,'');
const cashOnly=s({orders:[{customerId:'pig',quantity:1}]},[{id:'pig',name:'Rui Chen(微信:猪妹)',buildingId:'scape',note:'现金'}]);a.equal(cashOnly.cash.length,1);a.equal(cashOnly.cash[0].name,'Rui Chen(微信:猪妹)');a.equal(cashOnly.cash[0].note,'现金');
