import SwiftUI

struct OfflineFeature:Decodable {let t:[String:String];let p:[[Double]]}
struct OfflineMapData:Decodable {let features:[OfflineFeature]}
final class MapCache {static let shared=MapCache();let features:[OfflineFeature];init(){if let url=Bundle.main.url(forResource:"wembley",withExtension:"json"),let data=try? Data(contentsOf:url),let map=try? JSONDecoder().decode(OfflineMapData.self,from:data){features=map.features}else{features=[]}}}
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
    private let west = -0.290, east = -0.269, south=51.550, north=51.565
    var body:some View {
        GeometryReader{proxy in
            let size=proxy.size
            ZStack(alignment:.bottomLeading){
                Canvas{context,size in
                    func pt(_ lng:Double,_ lat:Double)->CGPoint {CGPoint(x:((lng-west)/(east-west)*size.width-size.width/2)*scale+size.width/2+offset.width,y:((north-lat)/(north-south)*size.height-size.height/2)*scale+size.height/2+offset.height)}
                    context.fill(Path(CGRect(origin:.zero,size:size)),with:.color(Color(red:0.94,green:0.95,blue:0.92)))
                    for f in MapCache.shared.features {
                        guard f.p.count>1 else{continue};var path=Path();for (i,p) in f.p.enumerated(){if i==0{path.move(to:pt(p[0],p[1]))}else{path.addLine(to:pt(p[0],p[1]))}}
                        if f.t["building"] != nil {path.closeSubpath();context.fill(path,with:.color(Color(red:0.83,green:0.86,blue:0.84)))}
                        else if f.t["leisure"] != nil || f.t["landuse"] == "grass" {path.closeSubpath();context.fill(path,with:.color(Color(red:0.81,green:0.88,blue:0.73)))}
                        else if f.t["highway"] != nil {context.stroke(path,with:.color(.white),lineWidth:max(2,3*scale))}
                    }
                    let coords=geometry.list;var route=Path();for(i,p) in coords.enumerated(){guard p.list.count==2 else{continue};let point=pt(p.list[0].double,p.list[1].double);if i==0{route.move(to:point)}else{route.addLine(to:point)}}
                    context.stroke(route,with:.color(.blue),style:StrokeStyle(lineWidth:4,lineCap:.round,lineJoin:.round))
                    for(i,s) in stops.enumerated(){let b=s["building"].exists ? s["building"]:s;let point=pt(b["lng"].double,b["lat"].double);let circle=CGRect(x:point.x-12,y:point.y-12,width:24,height:24);context.fill(Path(ellipseIn:circle),with:.color(Theme.ink));context.stroke(Path(ellipseIn:circle),with:.color(.white),lineWidth:2);context.draw(Text("\(i+1)").font(.system(size:11,weight:.bold)).foregroundColor(.white),at:point)}
                    for(p,color) in [(position,Color.blue),(pin,Color.green)] where p.exists {let point=pt(p["lng"].double,p["lat"].double);context.fill(Path(ellipseIn:CGRect(x:point.x-6,y:point.y-6,width:12,height:12)),with:.color(color));context.stroke(Path(ellipseIn:CGRect(x:point.x-7,y:point.y-7,width:14,height:14)),with:.color(.white),lineWidth:2)}
                }
                .gesture(DragGesture().onChanged{v in offset=CGSize(width:savedOffset.width+v.translation.width,height:savedOffset.height+v.translation.height)}.onEnded{_ in savedOffset=offset})
                .simultaneousGesture(MagnificationGesture().onChanged{value in scale=min(12,max(0.4,savedScale*value))}.onEnded{_ in savedScale=scale})
                .simultaneousGesture(SpatialTapGesture().onEnded{v in let x=((v.location.x-size.width/2-offset.width)/scale+size.width/2)/size.width;let y=((v.location.y-size.height/2-offset.height)/scale+size.height/2)/size.height;onPick?(west+x*(east-west),north-y*(north-south))})
                Text("© OpenStreetMap contributors · 离线地图").font(.system(size:9)).padding(4).background(.white.opacity(0.85)).allowsHitTesting(false)
                VStack{HStack{Spacer();VStack{Button{scale=min(12,scale*1.5);savedScale=scale}label:{Image(systemName:"plus")};Divider();Button{scale=max(0.4,scale/1.5);savedScale=scale}label:{Image(systemName:"minus")};Divider();Button{scale=1;savedScale=1;offset = .zero;savedOffset = .zero}label:{Image(systemName:"house")}}.padding(12).background(.white,in:RoundedRectangle(cornerRadius:12)).padding(8)};Spacer()}
            }.clipped().clipShape(RoundedRectangle(cornerRadius:16))
        }.accessibilityLabel("Wembley Park 配送地图")
    }
}
