import type {PositionFix} from './delivery';
export type DistanceState={metres:number;samples:number;gaps:boolean;anchor?:PositionFix};
function distance(a:PositionFix,b:PositionFix){const rad=Math.PI/180,x=(b.lng-a.lng)*rad*Math.cos((a.lat+b.lat)*rad/2),y=(b.lat-a.lat)*rad;return Math.hypot(x,y)*6371000;}
export function advanceDistance(s:DistanceState,p:PositionFix):DistanceState{
 if(![p.lat,p.lng,p.timestamp,p.accuracy].every(Number.isFinite)||p.accuracy<0||p.accuracy>40)return {...s,gaps:true};
 if(!s.anchor)return {...s,anchor:p,samples:s.samples+1};
 const dt=(p.timestamp-s.anchor.timestamp)/1000;if(dt<=0)return s;
 if(dt>90)return {...s,anchor:p,samples:s.samples+1,gaps:true};
 const d=distance(s.anchor,p);
 if(d/dt>3)return {...s,anchor:p,gaps:true};
 if(d<Math.max(8,Math.min(20,(p.accuracy+s.anchor.accuracy)/2)))return s;
 return {...s,metres:s.metres+d,anchor:p,samples:s.samples+1};
}
