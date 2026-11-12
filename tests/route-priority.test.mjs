import assert from 'node:assert/strict';import {deliveryWeight,prioritizeDeliveries,routeScore} from '../public/route-core.mjs';
assert.equal(deliveryWeight([{quantity:1}]),1);assert.equal(deliveryWeight([{quantity:2}]),1.5);assert.equal(deliveryWeight([{quantity:1},{quantity:1}]),1.5);assert.equal(deliveryWeight([{quantity:99}]),1.5);
const matrix=x=>[[0,100,x],[100,0,1000],[x,1000,0]];
assert.deepEqual(prioritizeDeliveries([1,2],matrix(190),[0,1,1]).order,[1,2]);
const yes=prioritizeDeliveries([1,2],matrix(190),[0,1,1.5]);assert.deepEqual(yes.order,[2,1]);assert.equal(yes.extraSeconds,90);assert.deepEqual(prioritizeDeliveries([1,2],matrix(191),[0,1,1.5]).order,[1,2]);
// Two-minute handovers influence weighted waiting, even for zero walking edges.
assert.equal(routeScore([1,2],[[0,0,0],[0,0,0],[0,0,0]],[0,1,1.5]).waiting,180);
let seed=37;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let t=0;t<200;t++){const n=8,m=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:Math.round(random()*1000))),w=[0,...Array.from({length:n-1},()=>random()>.5?1.5:1)],base=[1,2,3,4,5,6,7];for(const back of [false,true]){const r=prioritizeDeliveries(base,m,w,back);assert.deepEqual([...r.order].sort(),base);assert.equal(new Set(r.changes.map(x=>x.id)).size,r.changes.length);assert(r.changes.every(c=>w[c.id]>1&&c.extraSeconds<=90+1e-7));assert(r.extraSeconds<=90*r.changes.length+1e-6);assert(routeScore(r.order,m,w,back).waiting<=routeScore(base,m,w,back).waiting+1e-6);}}
console.log('PASS weights, single-box bypass, 90/91-second boundary, handover time, 400 directed open/return-route cases');
