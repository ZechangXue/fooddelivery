const fs=require('fs'),ts=require('typescript'),a=require('node:assert/strict');require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,p);
const {parseCustomerText,stripWeChatHeaders}=require('../lib/paste-import.ts');const map=JSON.parse(fs.readFileSync('public/data/wembley.json'));const state={customers:[],buildings:[],days:[]};
const raw=`是小新新呀 (郭老肥):
Trevor - 07700900001 - Brookline 11楼

是小新新呀 (郭老肥):
Scape Wembley, HA9 0TF Rui Chen 07700900002 - 现金（带零钱） - 猪妹

是小新新呀 (郭老肥):
iq sterling court，黄衿，07700900003

是小新新呀 (郭老肥):
landsby east - Tingting.Li - 07700900004 - 两份

是小新新呀 (郭老肥):
Flat 702, Barnard Point, 577 North End Road, Wembley, HA9 0QJ - Yudong Shen - 07700900005 - 圣主`;
for(const input of [raw,raw.replaceAll(' ', '\u00a0'),raw.replaceAll('\n','\r\n'),raw.replaceAll(':','：'),raw.replaceAll('\n\n','\n')]){
 const rows=parseCustomerText(input,state,map);a.equal(rows.length,5);a.deepEqual(rows.map(r=>r.name),['Trevor','Rui Chen','黄衿','Tingting.Li','Yudong Shen']);a.equal(rows[3].quantity,2);a(rows.every(r=>r.locationConfirmed));a(!JSON.stringify(rows).includes('郭老肥'));a(rows[1].note.includes('猪妹'));a(rows[1].note.includes('现金'));a.equal(rows[4].note,'圣主');a(!rows[1].address.includes('Rui Chen'));a(rows[0].address.includes('11楼'));
}
a.equal(stripWeChatHeaders('姓名:\n甲\n备注:\n带饮料'),'姓名:\n甲\n备注:\n带饮料');console.log('PASS five mobile WeChat customers across whitespace, CRLF, colon and message spacing variants');
