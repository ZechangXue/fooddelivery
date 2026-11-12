export function metres(a,b){return Math.hypot((a[0]-b[0])*111195*Math.cos((a[1]+b[1])*Math.PI/360),(a[1]-b[1])*111195);}
class Heap{items=[];push(cost,node){const a=this.items;let i=a.length;a.push([cost,node]);while(i){const p=(i-1)>>1;if(a[p][0]<=cost)break;a[i]=a[p];i=p;}a[i]=[cost,node];}pop(){const a=this.items,top=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let c=2*i+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c;}a[i]=last;}return top;}}
export function graphWithStops(map,places,speed){
 const coords=map.nodes.map(p=>p.slice()),adj=coords.map(()=>[]),selected=new Map(),snaps=[];
 const link=(a,b,d,factor,direction)=>{if(direction!==-1)adj[a].push({to:b,metres:d,seconds:d/(speed/3.6)*factor});if(direction!==1)adj[b].push({to:a,metres:d,seconds:d/(speed/3.6)*factor});};
 for(const place of places){const p=[place.lng,place.lat];if(place.lat<map.bounds.south||place.lat>map.bounds.north||place.lng<map.bounds.west||place.lng>map.bounds.east)throw new Error(place.name+' 不在当前离线地图范围内');let best=null;for(let e=0;e<map.edges.length;e++){const [a,b]=map.edges[e],pa=coords[a],pb=coords[b],scale=Math.cos(p[1]*Math.PI/180),dx=(pb[0]-pa[0])*scale,dy=pb[1]-pa[1],den=dx*dx+dy*dy;if(!den)continue;const t=Math.max(0,Math.min(1,((p[0]-pa[0])*scale*dx+(p[1]-pa[1])*dy)/den)),q=[pa[0]+t*(pb[0]-pa[0]),pa[1]+t*(pb[1]-pa[1])],d=metres(p,q);if(!best||d<best.d)best={e,t,q,d};}if(!best||best.d>60)throw new Error(place.name+' 离可步行道路超过 60 米，请将交接点移到楼下公共入口');const roadNode=coords.length;coords.push(best.q);adj.push([]);const stopNode=coords.length;coords.push(p);adj.push([]);link(roadNode,stopNode,best.d,1,0);const split=selected.get(best.e)||[];split.push({t:best.t,node:roadNode});selected.set(best.e,split);snaps.push(stopNode);}
 map.edges.forEach(([a,b,d,factor,direction],i)=>{const mids=selected.get(i);if(!mids){link(a,b,d,factor,direction);return;}const points=[{t:0,node:a},...mids.sort((x,y)=>x.t-y.t),{t:1,node:b}];for(let j=1;j<points.length;j++)link(points[j-1].node,points[j].node,d*(points[j].t-points[j-1].t),factor,direction);});
 return {coords,adj,snaps};
}
export function shortest(graph,start){const n=graph.adj.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),lengths=new Float64Array(n),heap=new Heap();dist[start]=0;heap.push(0,start);while(heap.items.length){const [cost,u]=heap.pop();if(cost>dist[u])continue;for(const edge of graph.adj[u]){const next=cost+edge.seconds;if(next<dist[edge.to]){dist[edge.to]=next;prev[edge.to]=u;lengths[edge.to]=lengths[u]+edge.metres;heap.push(next,edge.to);}}}return {dist,prev,lengths};}
export function solveOrder(matrix,roundTrip=false,progress=()=>{}){
 const n=matrix.length-1;if(n===0)return [];
 if(n>20)throw new Error('单趟最多支持 20 个交接楼栋，请分成两趟配送');
 const size=1<<n,INF=0xffffffff,dp=new Uint32Array(size*n).fill(INF),parent=new Int8Array(size*n).fill(-1);
 const cost=matrix.map(row=>row.map(v=>Number.isFinite(v)?Math.round(v*10):INF));
 const maxCost=Math.max(...cost.flat().filter(v=>v!==INF));const Arrivals=maxCost*n*(n+1)/2<INF?Uint32Array:Float64Array;const arrivals=new Arrivals(size*n).fill(INF);const counts=new Uint8Array(size);for(let mask=1;mask<size;mask++)counts[mask]=counts[mask>>1]+(mask&1);
 for(let j=0;j<n;j++){dp[(1<<j)*n+j]=cost[0][j+1];arrivals[(1<<j)*n+j]=n*cost[0][j+1];}
 for(let mask=1;mask<size;mask++){if((mask&131071)===0)progress('正在比较配送顺序 '+Math.round(mask/size*100)+'%…');let ends=mask;while(ends){const bit=ends&-ends,j=31-Math.clz32(bit);ends^=bit;const prevMask=mask^bit;if(!prevMask)continue;let candidates=prevMask,best=INF,bestArrival=Infinity,bestK=-1;while(candidates){const prevBit=candidates&-candidates,k=31-Math.clz32(prevBit);candidates^=prevBit;const previous=dp[prevMask*n+k],edge=cost[k+1][j+1];if(previous===INF||edge===INF)continue;const total=previous+edge,arrival=arrivals[prevMask*n+k]+(n-counts[mask]+1)*edge;if(total<best||(total===best&&arrival<bestArrival)){best=total;bestArrival=arrival;bestK=k;}}dp[mask*n+j]=best;arrivals[mask*n+j]=bestArrival;parent[mask*n+j]=bestK;}}
 let best=Infinity,bestArrival=Infinity,end=-1;for(let j=0;j<n;j++){const base=dp[(size-1)*n+j],back=roundTrip?cost[j+1][0]:0;if(base===INF||back===INF)continue;const total=base+back;if(total<best||(total===best&&arrivals[(size-1)*n+j]<bestArrival)){best=total;bestArrival=arrivals[(size-1)*n+j];end=j;}}
 if(end<0)throw new Error('部分位置之间没有连通的步行道路，请检查楼栋入口位置');
 const order=[];let mask=size-1;while(end>=0){order.push(end+1);const next=parent[mask*n+end];mask^=1<<end;end=next;}return order.reverse();
}
// Local improvement after the shortest-route baseline. Each qualifying building
// can be promoted once; each accepted promotion adds at most 90 seconds walking.
export function deliveryWeight(customers){const people=customers.length,boxes=customers.reduce((n,c)=>n+c.quantity,0);return Math.min(1.5,1+.5*Math.max(0,people-1)+.5*Math.max(0,boxes-1));}
export function routeScore(order,matrix,weights,roundTrip=false){let elapsed=0,walk=0,waiting=0,last=0;const arrivals={};for(const id of order){const leg=matrix[last][id];walk+=leg;elapsed+=leg;arrivals[id]=elapsed;waiting+=elapsed*weights[id];elapsed+=120;last=id;}if(roundTrip&&order.length)walk+=matrix[last][0];return {walk,waiting,arrivals};}
export function prioritizeDeliveries(baseline,matrix,weights,roundTrip=false){
 let order=[...baseline],score=routeScore(order,matrix,weights,roundTrip);const changes=[],used=new Set();
 for(let step=0;step<baseline.length;step++){let best=null;
  for(let from=1;from<order.length;from++){const id=order[from];if(weights[id]<=1||used.has(id))continue;
   for(let to=0;to<from;to++){const candidate=[...order];candidate.splice(from,1);candidate.splice(to,0,id);const next=routeScore(candidate,matrix,weights,roundTrip),extra=next.walk-score.walk,gain=score.waiting-next.waiting;
    if(!Number.isFinite(next.walk)||extra>90+1e-7||gain<=1e-7||next.arrivals[id]>=score.arrivals[id]-1e-7)continue;
    if(!best||gain>best.gain+1e-7||Math.abs(gain-best.gain)<1e-7&&extra<best.extra)best={id,candidate,next,extra,gain};
   }
  }
  if(!best)break;changes.push({id:best.id,extraSeconds:Math.max(0,best.extra)});used.add(best.id);order=best.candidate;score=best.next;
 }
 return {order,changes,extraSeconds:Math.max(0,score.walk-routeScore(baseline,matrix,weights,roundTrip).walk)};
}
function computeFreshPlan({map,day,buildings,customers,returnTo},progress=()=>{}){
 if(!day.orders.length)throw new Error('请先添加当日顾客');
 if(!Number.isFinite(day.speed)||day.speed<2||day.speed>7)throw new Error('步速应在每小时 2–7 公里之间');
 const origin=buildings.find(p=>p.id===day.originId);if(!origin)throw new Error('请先选择出发点');
 const grouped=new Map();for(const o of day.orders){if(!Number.isInteger(o.quantity)||o.quantity<0||o.quantity>99)throw new Error('盒饭份数须为 0–99 的整数，0 表示仅单点');const c=customers.find(c=>c.id===o.customerId);if(!c)throw new Error('顾客记录缺失');const b=buildings.find(b=>b.id===c.buildingId);if(!b)throw new Error('楼栋记录缺失');const group=grouped.get(b.id)||{building:b,customers:[]};group.customers.push({...c,quantity:o.quantity});grouped.set(b.id,group);}
 const groups=[...grouped.values()];if(groups.length>20)throw new Error('最多支持 20 个交接楼栋，请拆分配送');
 const places=[origin,...groups.map(g=>g.building),...(day.roundTrip&&returnTo?[returnTo]:[])],graph=graphWithStops(map,places,day.speed);
 const routes=graph.snaps.map(s=>shortest(graph,s));
 const matrix=routes.map(r=>graph.snaps.map(s=>r.dist[s]));
 const orderMatrix=matrix.slice(0,groups.length+1).map(row=>row.slice(0,groups.length+1));if(day.roundTrip&&returnTo)for(let i=1;i<orderMatrix.length;i++)orderMatrix[i][0]=matrix[i][places.length-1];
 const baseline=solveOrder(orderMatrix,day.roundTrip,progress);
 const weights=[0,...groups.map(g=>deliveryWeight(g.customers))];
 const priority=prioritizeDeliveries(baseline,orderMatrix,weights,day.roundTrip),order=priority.order;
 let elapsed=0,walk=0,distance=0,last=0,geometry=[],stops=[];
 function leg(from,to){const target=graph.snaps[to],source=graph.snaps[from],r=routes[from];if(!Number.isFinite(r.dist[target]))throw new Error('步行道路不连通');const path=[];let n=target;while(n!==source){path.push(graph.coords[n]);n=r.prev[n];if(n<0)throw new Error('步行道路不连通');}path.push(graph.coords[source]);path.reverse();geometry.push(...(geometry.length?path.slice(1):path));return {seconds:r.dist[target],distance:r.lengths[target],path};}
 for(const index of order){const l=leg(last,index);elapsed+=l.seconds;walk+=l.seconds;distance+=l.distance;const group=groups[index-1];stops.push({...group,arrivalSeconds:elapsed,walkSeconds:l.seconds,distance:l.distance,completed:false,segmentGeometry:l.path});elapsed+=120;last=index;}
 let returnSeconds=0;if(day.roundTrip){const l=leg(last,returnTo?places.length-1:0);returnSeconds=l.seconds;elapsed+=l.seconds;walk+=l.seconds;distance+=l.distance;}
 return {stops,geometry,walkSeconds:walk,totalSeconds:elapsed,distance,returnSeconds,algorithm:priority.changes.length?'多客多盒优先 · 每栋额外绕路≤90秒 · 本次增加约'+Math.ceil(priority.extraSeconds)+'秒 · 路网 v2':'最短总步行时间 · 无需加权调整 · 路网 v2',generatedAt:new Date().toISOString()};
}

export function computeRemaining({map,day,position,now=Date.now(),returnTo}){
 if(!day.plan)throw new Error('请先规划路线');
 if(!position||!Number.isFinite(position.lat)||!Number.isFinite(position.lng)||!Number.isFinite(position.timestamp)||now-position.timestamp>45000||position.timestamp>now+5000||!Number.isFinite(position.accuracy)||position.accuracy>60)throw new Error('定位不够准确或已过期，请等待新位置');
 const stops=day.plan.stops.filter(s=>!s.completed).map(s=>({...s,customers:s.customers.filter(c=>!c.delivered)})).filter(s=>s.customers.length);
 if(!stops.length)return {stops:[],geometry:[],totalSeconds:0,walkSeconds:0,distance:0,returnSeconds:0,baseAt:now};
 if(!Number.isFinite(day.speed)||day.speed<2||day.speed>7)throw new Error('步速应在每小时 2–7 公里之间');
 const start={id:'current-location',name:'当前位置',address:'',lat:position.lat,lng:position.lng};
 if(day.roundTrip&&!returnTo)throw new Error('回程出发点缺失');
 const places=[start,...stops.map(s=>s.building),...(day.roundTrip?[returnTo]:[])],graph=graphWithStops(map,places,day.speed);
 let elapsed=0,walk=0,distance=0,geometry=[],updated=[],returnSeconds=0;
 for(let i=1;i<places.length;i++){
  const source=graph.snaps[i-1],target=graph.snaps[i],route=shortest(graph,source);
  if(!Number.isFinite(route.dist[target]))throw new Error('当前位置到下一站没有连通的步行道路，请检查定位和入口');
  const path=[];let n=target;while(n!==source){path.push(graph.coords[n]);n=route.prev[n];if(n<0)throw new Error('步行道路不连通');}path.push(graph.coords[source]);path.reverse();geometry.push(...(geometry.length?path.slice(1):path));
  const seconds=route.dist[target];elapsed+=seconds;walk+=seconds;distance+=route.lengths[target];
  if(i<=stops.length){updated.push({...stops[i-1],arrivalSeconds:elapsed,walkSeconds:seconds,distance:route.lengths[target],segmentGeometry:path});elapsed+=120;}else returnSeconds=seconds;
 }
 return {stops:updated,geometry,totalSeconds:elapsed,walkSeconds:walk,distance,returnSeconds,baseAt:now};
}

export function computePlan(input,progress=()=>{}){
 const {day,position,now=Date.now()}=input;if(!day.startedAt)return computeFreshPlan(input,progress);
 const done=(day.plan?.stops||[]).map(s=>({...s,customers:s.customers.filter(c=>s.completed||c.delivered),completed:true})).filter(s=>s.customers.length);
 const ids=new Set(done.flatMap(s=>s.customers.map(c=>c.id))),orders=day.orders.filter(o=>!ids.has(o.customerId));
 if(!orders.length)throw Error('目前没有待送顾客，请先添加顾客，或结束后开始下一趟');
 const home=input.buildings.find(b=>b.id===day.originId),last=done.at(-1)?.building;
 const fresh=position&&now-position.timestamp<=45000&&position.accuracy<=60;
 const start=fresh?{id:'current-routing-position',name:'当前位置',address:'当前位置',lat:position.lat,lng:position.lng}:last||home;
 const plan=computeFreshPlan({...input,day:{...day,orders,originId:start.id},buildings:[...input.buildings.filter(b=>b.id!==start.id),start],returnTo:home},progress);
 const elapsed=Math.max(0,(now-Date.parse(day.startedAt))/1000);
 return {...plan,stops:[...done,...plan.stops.map(s=>({...s,arrivalSeconds:s.arrivalSeconds+elapsed}))],totalSeconds:plan.totalSeconds+elapsed,algorithm:plan.algorithm+' · 剩余路线从'+(fresh?'当前位置':last?'最近已送达楼栋':'出发点')+'重排'};
}
