import SwiftUI

struct Theme {static let ink=Color(red:0.055,green:0.10,blue:0.18);static let lime=Color(red:0.80,green:0.94,blue:0.25);static let background=Color(red:0.95,green:0.96,blue:0.98)}
struct Card<Content:View>:View {let content:Content;init(@ViewBuilder content:()->Content){self.content=content()};var body:some View{VStack(alignment:.leading,spacing:14){content}.padding(16).frame(maxWidth:.infinity,alignment:.leading).background(.white,in:RoundedRectangle(cornerRadius:22)).overlay(RoundedRectangle(cornerRadius:22).stroke(Color.black.opacity(0.04))).shadow(color:.black.opacity(0.025),radius:6,y:2)}}
struct MainButton:View {@Environment(\.isEnabled) private var enabled;let title:String;var icon="figure.walk";let action:()->Void;var body:some View{Button(action:action){Label(title,systemImage:icon).font(.headline).frame(maxWidth:.infinity).padding(17).foregroundColor(.white).background(Theme.ink,in:RoundedRectangle(cornerRadius:17))}.buttonStyle(.plain).opacity(enabled ? 1:0.45)}}
struct NativeRoot:View {
    @StateObject var store=NativeStore()
    var body:some View{
        ZStack {
            TabView {
                NavigationStack{TodayView()}.tabItem{Label("每日配送",systemImage:"shippingbox")}
                NavigationStack{DirectoryView()}.tabItem{Label("顾客与楼栋",systemImage:"building.2")}
                NavigationStack{HistoryView()}.tabItem{Label("历史记录",systemImage:"clock")}
                NavigationStack{StatisticsView()}.tabItem{Label("经营统计",systemImage:"chart.bar")}
            }.tint(Theme.ink).environmentObject(store)
            if !store.login {SessionWeb(store:store).frame(width:1,height:1).opacity(0.01).allowsHitTesting(false).accessibilityHidden(true)}
        }
        .sheet(isPresented:$store.login){NavigationStack{SessionWeb(store:store).navigationTitle("登录配送账户").toolbar{ToolbarItem(placement:.confirmationAction){Button("完成"){store.login=false;store.reconnect()}}}.onAppear{store.beginLogin()}}}
        .alert("提示",isPresented:Binding(get:{store.error != nil},set:{if !$0{store.error=nil}})){Button("知道了"){store.error=nil}}message:{Text(store.error ?? "")}
        .overlay(alignment:.top){if store.busy {ProgressView("正在处理…").padding(12).background(.regularMaterial,in:Capsule()).padding(.top,8)}}
    }
}
struct Brand:View {var body:some View{HStack{Image(systemName:"figure.walk").font(.title).foregroundColor(Theme.lime).frame(width:46,height:46).background(Theme.ink,in:RoundedRectangle(cornerRadius:14));VStack(alignment:.leading){Text("步送").font(.title2.bold());Text("WEMBLEY PARK").font(.system(size:9,weight:.bold)).tracking(2)};Spacer();Text("步行 · 楼下交接").font(.caption).padding(10).background(Theme.lime.opacity(0.25),in:Capsule())}.foregroundColor(Theme.ink)}}
struct TodayView:View {
    @EnvironmentObject var s:NativeStore
    @State var menu=false;@State var settings=false;@State var add=false;@State var paste=false
    var body:some View {
        ScrollView{VStack(spacing:16){
            Brand();VStack(alignment:.leading,spacing:4){Text("你的邻里配送助手").foregroundStyle(.secondary).font(.subheadline);Text("把每一餐，顺路送到。").font(.title2.bold())}.frame(maxWidth:.infinity,alignment:.leading)
            if !s.connected {Card{Text("连接你的配送账户").font(.headline);Text("与网页共用顾客、菜单和配送记录。").foregroundStyle(.secondary);MainButton(title:"登录 / 重新连接",icon:"person.crop.circle"){s.beginLogin()}}}
            else {
                Card{HStack{Label("当日菜单",systemImage:"fork.knife").font(.headline);Spacer();Button("修改菜单"){menu=true}};Text(s.state["menus"].list.first{$0["date"].text==s.day["date"].text}?["dishes"].list.map{$0["name"].text}.joined(separator:" + ") ?? "尚未记录菜单").font(.subheadline).foregroundStyle(.secondary)}
                Card{
                    Button{settings=true}label:{HStack{Image(systemName:"mappin.and.ellipse").font(.title2);VStack(alignment:.leading){Text("从这里出发").font(.headline);Text(s.label(s.day["originId"].text).isEmpty ? "选择出发点":s.label(s.day["originId"].text)).font(.subheadline).foregroundStyle(.secondary)};Spacer();Image(systemName:"chevron.right")}.foregroundColor(Theme.ink)}
                    Divider();HStack{Label(s.day["date"].text,systemImage:"calendar");Spacer();Label(s.day["departure"].text,systemImage:"clock")}.font(.subheadline)
                    HStack{Label("步行速度",systemImage:"figure.walk");Spacer();Text(String(format:"%.1f 公里 / 小时",s.day["speed"].double));Button{settings=true}label:{Image(systemName:"chevron.down")}}.font(.subheadline)
                    if s.day["finishedAt"].exists {MainButton(title:"开始下一趟配送"){s.perform{try await s.next()}}}
                    else if s.day["startedAt"].exists {Label("本趟配送中",systemImage:"location.fill").font(.headline);Text(s.locationMessage).font(.caption).foregroundStyle(.secondary)}
                    else {MainButton(title:"我出发啦"){s.perform{try await s.depart()}}.disabled(s.day["orders"].list.isEmpty)}
                }
                Card{
                    HStack{Label("本趟顾客",systemImage:"person.2").font(.headline);Spacer();Text("\(s.day["orders"].list.count) 位").foregroundStyle(.secondary);Button{add=true}label:{Image(systemName:"plus.circle.fill").font(.title2)}}
                    Button{paste=true}label:{Label("粘贴微信顾客信息",systemImage:"doc.on.clipboard").frame(maxWidth:.infinity,alignment:.leading).padding(12).background(Color.blue.opacity(0.07),in:RoundedRectangle(cornerRadius:12))}
                    NavigationLink {OrdersView()} label:{HStack{Text("查看本趟顾客 · \(s.day["orders"].list.reduce(0){$0+$1["quantity"].int}) 盒");Spacer();Image(systemName:"chevron.right")}}
                    if !s.day["orders"].list.isEmpty {MainButton(title:s.day["plan"].exists ? "更新步行路线":"规划步行路线",icon:"point.topleft.down.curvedto.point.bottomright.up"){s.perform{try await s.plan()}}}
                    if s.dirty {Button("保存配送单"){s.perform{try await s.saveDay(s.day)}}.frame(maxWidth:.infinity)}
                }
                Card{NavigationLink{MapScreen()}label:{HStack{Label("配送地图",systemImage:"map").font(.headline);Spacer();Text("待送 \(s.pending.count) 栋楼").font(.caption);Image(systemName:"chevron.right")}.foregroundColor(Theme.ink)};NativeMap(stops:s.displayStops,geometry:s.fresh && s.live.exists ? s.live["geometry"]:s.day["plan"]["geometry"],position:s.fresh ? s.position:.null).frame(height:320)}
                if s.day["plan"].exists {Card{NavigationLink{RouteView()}label:{HStack{Label("待送 \(s.pending.count) 栋楼",systemImage:"shippingbox").font(.headline);Spacer();Text("查看全部");Image(systemName:"chevron.right")}};ForEach(Array(s.displayStops.prefix(3).enumerated()),id:\.offset){i,stop in HStack{NumberBadge(number:i+1);VStack(alignment:.leading){Text(stop["building"]["name"].text).font(.subheadline.bold());Text(stop["building"]["address"].text).font(.caption).foregroundStyle(.secondary)};Spacer();Text(s.eta(stop)).foregroundColor(.blue).bold()}}}}
                Card{Label("顾客查询页",systemImage:"person.crop.circle.badge.questionmark").font(.headline);Text(s.trackingMessage.isEmpty ? "保存配送单后自动同步":s.trackingMessage).font(.caption).foregroundStyle(.secondary);if let url=URL(string:s.trackingURL),!s.trackingURL.isEmpty {ShareLink(item:url){Label("分享查询链接",systemImage:"square.and.arrow.up")}};Button("立即同步"){Task{await s.syncTracking()}}}
            }
        }.padding(16).padding(.bottom,16)}.background(Theme.background).navigationBarHidden(true)
        .sheet(isPresented:$menu){MenuSheet().environmentObject(s)}.sheet(isPresented:$settings){SettingsSheet().environmentObject(s)}.sheet(isPresented:$add){AddOrderSheet().environmentObject(s)}.sheet(isPresented:$paste){PasteSheet().environmentObject(s)}
        .refreshable{if s.ready{s.perform{try await s.refresh()}}else{s.reconnect()}}
    }
}
struct NumberBadge:View {let number:Int;var body:some View{Text(String(format:"%02d",number)).font(.subheadline.bold()).foregroundColor(Theme.lime).frame(width:34,height:34).background(Theme.ink,in:Circle())}}
struct OrderRow:View { @EnvironmentObject var s:NativeStore;let order:J
    var body:some View{let c=s.customer(order["customerId"].text);VStack(alignment:.leading,spacing:7){HStack{VStack(alignment:.leading){Text(c["name"].text).bold();Text(s.label(c["buildingId"].text)).font(.caption).foregroundStyle(.secondary)};Spacer();Text("\(order["quantity"].int) 盒");Menu{Button("增加一盒"){change(1)};Button("减少一盒"){change(-1)};Button("移除顾客",role:.destructive){s.perform{try await s.edit(["orders":.array(s.day["orders"].list.filter{$0["customerId"] != order["customerId"]})])}}}label:{Image(systemName:"ellipsis.circle").padding(8)}};PhoneLink(phone:c["phone"].text);if !c["note"].text.isEmpty{Text(c["note"].text).font(.caption).foregroundStyle(.secondary)};Divider()}}
    func change(_ count:Int){s.perform{let orders=s.day["orders"].list.map{$0["customerId"]==order["customerId"] ? $0.setting("quantity",num(Double(max(0,min(99,$0["quantity"].int+count))))):$0};try await s.edit(["orders":.array(orders)])}}
}
struct SettingsSheet:View {
    @EnvironmentObject var s:NativeStore;@Environment(\.dismiss) var dismiss
    @State var origin="";@State var date=Date();@State var departure=Date();@State var speed=4.5;@State var round=false
    var body:some View{NavigationStack{Form{Section("出发设置"){Picker("出发点",selection:$origin){Text("请选择").tag("");ForEach(s.buildings){b in Text(s.label(b.id)).tag(b.id)}};DatePicker("配送日期",selection:$date,displayedComponents:.date);DatePicker("出发时间",selection:$departure,displayedComponents:.hourAndMinute);Stepper(value:$speed,in:2...7,step:0.5){Text(String(format:"步行速度 %.1f 公里/小时",speed))};Toggle("考虑送完后的回程",isOn:$round)};Section{Text("每栋楼停留 2 分钟，同楼多位顾客只计算一次。").font(.footnote)}}.navigationTitle("出发设置").toolbar{ToolbarItem(placement:.cancellationAction){Button("取消"){dismiss()}};ToolbarItem(placement:.confirmationAction){Button("保存"){s.perform{if londonDate(date) != s.day["date"].text{try await s.chooseDate(londonDate(date))};let f=DateFormatter();f.timeZone=TimeZone(identifier:"Europe/London");f.dateFormat="HH:mm";try await s.edit(["originId":str(origin),"departure":str(f.string(from:departure)),"speed":num(speed),"roundTrip":.bool(round)]);try await s.saveDay(s.day);dismiss()}}.disabled(s.busy)}}.onAppear{origin=s.day["originId"].text;date=dateValue(s.day["date"].text);speed=s.day["speed"].double;round=s.day["roundTrip"].flag;let f=DateFormatter();f.timeZone=TimeZone(identifier:"Europe/London");f.dateFormat="HH:mm";departure=f.date(from:s.day["departure"].text) ?? Date()}}}
}
struct MenuSheet:View { @EnvironmentObject var s:NativeStore;@Environment(\.dismiss) var dismiss;@State var text=""
    var body:some View{NavigationStack{Form{Section("粘贴当天菜单"){TextEditor(text:$text).frame(minHeight:180);Text("例如：红烧肉 + 炖排骨 + 西葫芦炒蛋").font(.caption).foregroundStyle(.secondary)}}.navigationTitle("当日菜单").toolbar{ToolbarItem(placement:.cancellationAction){Button("取消"){dismiss()}};ToolbarItem(placement:.confirmationAction){Button("保存"){s.perform{let menu=try await s.call("menu",obj(["text":str(text),"date":s.day["date"]]));try await s.save("menu",menu);dismiss()}}.disabled(text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty || s.busy)}}.onAppear{text=s.state["menus"].list.first{$0["date"]==s.day["date"]}?["raw"].text ?? ""}}}
}
struct AddOrderSheet:View {@EnvironmentObject var s:NativeStore;@Environment(\.dismiss) var dismiss;@State var search="";var body:some View{NavigationStack{List(s.customers.filter{search.isEmpty || ($0["name"].text+$0["phone"].text+s.label($0["buildingId"].text)).localizedCaseInsensitiveContains(search)}){c in Button{s.perform{var orders=s.day["orders"].list;if let index=orders.firstIndex(where:{$0["customerId"].text==c.id}){orders[index]["quantity"]=num(Double(orders[index]["quantity"].int+1))}else{orders.append(obj(["customerId":str(c.id),"quantity":num(1)]))};try await s.edit(["orders":.array(orders)]);dismiss()}}label:{VStack(alignment:.leading){Text(c["name"].text);Text(s.label(c["buildingId"].text)).font(.caption).foregroundStyle(.secondary)}}}.searchable(text:$search,prompt:"搜索姓名、电话或公寓").navigationTitle("添加常客").toolbar{Button("完成"){dismiss()}}}}}

struct OrdersView:View {
    @EnvironmentObject var s:NativeStore
    @State private var add=false
    @State private var paste=false
    var body:some View {
        ScrollView {
            VStack(spacing:16) {
                Card {
                    Button {paste=true} label:{Label("粘贴微信顾客信息",systemImage:"doc.on.clipboard")}
                    ForEach(s.day["orders"].list,id:\.self) {order in OrderRow(order:order)}
                    if s.day["orders"].list.isEmpty {Text("本趟还没有顾客").foregroundStyle(.secondary)}
                }
                if !s.day["orders"].list.isEmpty {
                    MainButton(title:"更新步行路线",icon:"map") {s.perform{try await s.plan()}}
                }
                if s.dirty {Button("保存配送单"){s.perform{try await s.saveDay(s.day)}}}
            }.padding(16)
        }
        .background(Theme.background)
        .navigationTitle("本趟顾客 \(s.day["orders"].list.count) 位")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {Button {add=true} label:{Label("添加常客",systemImage:"plus")}}
        .sheet(isPresented:$add){AddOrderSheet().environmentObject(s)}
        .sheet(isPresented:$paste){PasteSheet().environmentObject(s)}
    }
}
