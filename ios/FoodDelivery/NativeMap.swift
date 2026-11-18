import SwiftUI

struct OfflineFeature:Decodable {let t:[String:String];let p:[[Double]]}
struct OfflineMapData:Decodable {let features:[OfflineFeature]}
final class MapCache {static let shared=MapCache();let features:[OfflineFeature];init(){if let url=Bundle.main.url(forResource:"wembley",withExtension:"json"),let data=try? Data(contentsOf:url),let map=try? JSONDecoder().decode(OfflineMapData.self,from:data){features=map.features}else{features=[]}}}
// One metres-to-points scale for both axes, including tap-to-coordinate conversion.
struct MapProjection {
    let center:CGPoint
    let size:CGSize
    let factor:Double
    let zoom:Double
    let offset:CGSize
    static let longitudeMetres=111195.0*cos(51.56*Double.pi/180)
    init(points:[CGPoint],size:CGSize,zoom:Double=1,offset:CGSize = .zero) {
        let points=points.isEmpty ? [CGPoint(x:-0.290,y:51.550),CGPoint(x:-0.269,y:51.565)]:points
        let xs=points.map(\.x),ys=points.map(\.y)
        let west=Double(xs.min()!),east=Double(xs.max()!),south=Double(ys.min()!),north=Double(ys.max()!)
        center=CGPoint(x:(west+east)/2,y:(south+north)/2)
        self.size=size;self.zoom=zoom;self.offset=offset
        let width:Double=max(300.0,(east-west)*Self.longitudeMetres)
        let height:Double=max(300.0,(north-south)*111195)
        factor=min(max(1.0,Double(size.width)-88.0)/width,max(1.0,Double(size.height)-88.0)/height)
    }
    func point(_ lng:Double,_ lat:Double)->CGPoint {
        let x=Double(size.width)/2+(lng-Double(center.x))*Self.longitudeMetres*factor*zoom+Double(offset.width)
        let y=Double(size.height)/2-(lat-Double(center.y))*111195*factor*zoom+Double(offset.height)
        return CGPoint(x:x,y:y)
    }
    func coordinate(_ p:CGPoint)->CGPoint {
        let x=Double(center.x)+(Double(p.x)-Double(size.width)/2-Double(offset.width))/(Self.longitudeMetres*factor*zoom)
        let y=Double(center.y)-(Double(p.y)-Double(size.height)/2-Double(offset.height))/(111195*factor*zoom)
        return CGPoint(x:x,y:y)
    }
}
struct NativeMap:View {
    var stops:[J]=[]
    var geometry:J = .array([])
    var position:J = .null
    var pin:J = .null
    var onPick:((Double,Double)->Void)?
    @State private var scale:CGFloat=1
    @State private var savedScale:CGFloat=1
    @State private var offset=CGSize.zero
    @State private var savedOffset=CGSize.zero
    private var fitPoints:[CGPoint] {
        var points=geometry.list.compactMap {p -> CGPoint? in guard p.list.count==2 else{return nil};return CGPoint(x:p.list[0].double,y:p.list[1].double)}
        points += stops.map {s in let b=s["building"].exists ? s["building"]:s;return CGPoint(x:b["lng"].double,y:b["lat"].double)}
        if pin.exists {points.append(CGPoint(x:pin["lng"].double,y:pin["lat"].double))}
        return points
    }
    private func mapControl(_ icon:String,label:String,action:@escaping ()->Void)->some View {
        Button(action:action){Image(systemName:icon).font(.system(size:17,weight:.semibold)).frame(width:44,height:44).contentShape(Rectangle())}.buttonStyle(.plain).accessibilityLabel(label)
    }
    var body:some View {
        GeometryReader{proxy in
            let size=proxy.size
            let projection=MapProjection(points:fitPoints,size:size,zoom:Double(scale),offset:offset)
            ZStack(alignment:.bottomLeading){
                Canvas{context,size in
                    func pt(_ lng:Double,_ lat:Double)->CGPoint {projection.point(lng,lat)}
                    context.fill(Path(CGRect(origin:.zero,size:size)),with:.color(Color(red:0.94,green:0.95,blue:0.92)))
                    for f in MapCache.shared.features {
                        guard f.p.count>1 else{continue};var path=Path();for (i,p) in f.p.enumerated(){if i==0{path.move(to:pt(p[0],p[1]))}else{path.addLine(to:pt(p[0],p[1]))}}
                        if f.t["building"] != nil {path.closeSubpath();context.fill(path,with:.color(Color(red:0.83,green:0.86,blue:0.84)))}
                        else if f.t["leisure"] != nil || f.t["landuse"] == "grass" {path.closeSubpath();context.fill(path,with:.color(Color(red:0.81,green:0.88,blue:0.73)))}
                        else if f.t["highway"] != nil {context.stroke(path,with:.color(.white),lineWidth:max(2,3*scale))}
                    }
                    // Keep nearby apartment and street names legible without overlapping labels.
                    var labelRects:[CGRect]=[]
                    for f in MapCache.shared.features where !f.p.isEmpty {
                        guard let name=f.t["name"], !name.isEmpty,
                              f.t["building"] != nil || f.t["highway"] != nil else {continue}
                        let lng=f.p.reduce(0){$0+$1[0]}/Double(f.p.count)
                        let lat=f.p.reduce(0){$0+$1[1]}/Double(f.p.count)
                        let point=pt(lng,lat)
                        let bounds=CGRect(x:point.x-44,y:point.y-9,width:88,height:18)
                        guard CGRect(origin:.zero,size:size).contains(point),
                              !labelRects.contains(where:{$0.intersects(bounds)}) else {continue}
                        labelRects.append(bounds)
                        context.draw(Text(String(name.prefix(30))).font(.system(size:10)).foregroundColor(Color.black.opacity(0.70)),at:point)
                    }
                    let coords=geometry.list;var route=Path();for(i,p) in coords.enumerated(){guard p.list.count==2 else{continue};let point=pt(p.list[0].double,p.list[1].double);if i==0{route.move(to:point)}else{route.addLine(to:point)}}
                    context.stroke(route,with:.color(.blue),style:StrokeStyle(lineWidth:4,lineCap:.round,lineJoin:.round))
                    for(i,s) in stops.enumerated(){let b=s["building"].exists ? s["building"]:s;let point=pt(b["lng"].double,b["lat"].double);let circle=CGRect(x:point.x-12,y:point.y-12,width:24,height:24);context.fill(Path(ellipseIn:circle),with:.color(Theme.ink));context.stroke(Path(ellipseIn:circle),with:.color(.white),lineWidth:2);context.draw(Text("\(i+1)").font(.system(size:11,weight:.bold)).foregroundColor(.white),at:point)}
                    for(p,color) in [(position,Color.blue),(pin,Color.green)] where p.exists {let point=pt(p["lng"].double,p["lat"].double);context.fill(Path(ellipseIn:CGRect(x:point.x-6,y:point.y-6,width:12,height:12)),with:.color(color));context.stroke(Path(ellipseIn:CGRect(x:point.x-7,y:point.y-7,width:14,height:14)),with:.color(.white),lineWidth:2)}
                }
                .gesture(DragGesture().onChanged{v in offset=CGSize(width:savedOffset.width+v.translation.width,height:savedOffset.height+v.translation.height)}.onEnded{_ in savedOffset=offset})
                .simultaneousGesture(MagnificationGesture().onChanged{value in scale=min(12,max(0.4,savedScale*value))}.onEnded{_ in savedScale=scale})
                .simultaneousGesture(SpatialTapGesture().onEnded{v in let coordinate=projection.coordinate(v.location);onPick?(coordinate.x,coordinate.y)})
                Text("© OpenStreetMap contributors · 离线地图").font(.system(size:9)).padding(4).background(.white.opacity(0.85)).allowsHitTesting(false)
                VStack(spacing:0) {
                    mapControl("plus",label:"放大地图"){scale=min(12,scale*1.5);savedScale=scale}
                    Divider().frame(width:30)
                    mapControl("minus",label:"缩小地图"){scale=max(0.4,scale/1.5);savedScale=scale}
                    Divider().frame(width:30)
                    mapControl("arrow.up.left.and.arrow.down.right",label:"显示完整路线"){scale=1;savedScale=1;offset = .zero;savedOffset = .zero}
                }.frame(width:44).background(.white,in:RoundedRectangle(cornerRadius:12))
                 .shadow(color:.black.opacity(0.15),radius:4,y:2)
                 .padding(10).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topTrailing)
            }.clipped().clipShape(RoundedRectangle(cornerRadius:16))
        }.accessibilityLabel("Wembley Park 配送地图")
    }
}
