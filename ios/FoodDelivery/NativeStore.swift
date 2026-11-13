import SwiftUI
import WebKit
import CoreLocation

@MainActor final class NativeStore:NSObject,ObservableObject,WKNavigationDelegate,WKUIDelegate,CLLocationManagerDelegate {
    @Published var state:J = obj(["customers":.array([]),"buildings":.array([]),"days":.array([]),"revision":num(0)])
    @Published var day:J = .null
    @Published var busy=false
    @Published var ready=false
    @Published var connected=false
    @Published var login=false
    @Published var error:String?
    @Published var dirty=false
    @Published var packing:J = .null
    @Published var labels:J = .null
    @Published var live:J = .null
    @Published var position:J = .null
    @Published var locationMessage="未开启定位"
    @Published var trackingMessage=""
    @Published var trackingURL=""
    @Published var distance:J = obj(["metres":num(0),"samples":num(0),"gaps":.bool(false)])
    let web:WKWebView
    let manager=CLLocationManager()
    var tracking=false
    var timer:Timer?
    var lastFix=Date.distantPast
    var calculating=false
    var syncBusy=false
    var demo=false
    var popup:WKWebView?
    override init(){
        let config=WKWebViewConfiguration();config.websiteDataStore = .default();config.preferences.javaScriptCanOpenWindowsAutomatically=true
        web=WKWebView(frame:.zero,configuration:config)
        super.init()
        web.navigationDelegate=self;web.uiDelegate=self
        manager.delegate=self;manager.desiredAccuracy=kCLLocationAccuracyBest;manager.distanceFilter=3;manager.activityType = .fitness
        NotificationCenter.default.addObserver(self,selector:#selector(background),name:UIApplication.didEnterBackgroundNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(foreground),name:UIApplication.didBecomeActiveNotification,object:nil)
        demo=ProcessInfo.processInfo.arguments.contains("--ui-testing")
        if demo {loadDemo();return}
        web.load(URLRequest(url:AppPolicy.home.appendingPathComponent("api/state")))
        timer=Timer.scheduledTimer(withTimeInterval:15,repeats:true){[weak self] _ in Task {@MainActor in await self?.syncTracking()}}
    }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
        guard webView === web,AppPolicy.isTrusted(webView.url) else{return}
        if webView.url?.path != "/api/state" {webView.load(URLRequest(url:AppPolicy.home.appendingPathComponent("api/state")));return}
        Task {do {
            let engine=try String(contentsOf:Bundle.main.url(forResource:"engine",withExtension:"js")!)
            let worker=try String(contentsOf:Bundle.main.url(forResource:"routeWorker",withExtension:"js")!)
            _ = try await web.evaluateJavaScript("window.deliveryWorkerSource="+str(worker).json+";"+engine)
            ready=true;try await refresh();login=false
        }catch{handle(error)}}
    }
    func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError failure:Error){if (failure as NSError).code != NSURLErrorCancelled {error="连接失败，请检查网络后重试。"}}
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView){ready=false;error="数据连接已暂停。未保存的表单仍保留，请重新连接。"}
    func reconnect(){if dirty{error="请先保存或放弃当前修改，再重新连接。";return};web.load(URLRequest(url:AppPolicy.home.appendingPathComponent("api/state")))}
    func beginLogin(){login=true;web.load(URLRequest(url:URL(string:"signin-with-chatgpt?return_to=/api/state",relativeTo:AppPolicy.home)!.absoluteURL))}
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for navigationAction:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? {let child=WKWebView(frame:web.bounds,configuration:configuration);child.navigationDelegate=self;child.uiDelegate=self;child.autoresizingMask=[.flexibleWidth,.flexibleHeight];web.addSubview(child);popup=child;return child}
    func webViewDidClose(_ webView:WKWebView){webView.removeFromSuperview();popup=nil;web.load(URLRequest(url:AppPolicy.home.appendingPathComponent("api/state")))}
    func call(_ op:String,_ p:J = obj([:])) async throws->J {
        guard ready,AppPolicy.isTrusted(web.url) else{throw NSError(domain:"步送",code:1,userInfo:[NSLocalizedDescriptionKey:"请先连接账户"])}
        let result=try await web.callAsyncJavaScript("return JSON.stringify(await window.deliveryEngine.run(operation,JSON.parse(payload)))",arguments:["operation":op,"payload":p.json],in:nil,contentWorld:.page)
        return try J.parse(result as? String ?? "null")
    }
    func handle(_ failure:Error){let message=(failure as NSError).userInfo["WKJavaScriptExceptionMessage"] as? String ?? failure.localizedDescription;if message.contains("AUTH_REQUIRED"){connected=false;login=true;error="请登录原来的配送账户"}else{error=message}}
    func perform(_ task:@escaping ()async throws->Void){guard !busy else{return};busy=true;Task{defer{busy=false};do{try await task()}catch{handle(error)}}}
    func refresh()async throws {guard !dirty else{throw NSError(domain:"步送",code:1,userInfo:[NSLocalizedDescriptionKey:"请先保存当前配送单"])};let value=try await call("read");state=value;connected=true;let date=day["date"].text.isEmpty ? londonDate():day["date"].text;if let saved=value["days"].list.first(where:{$0["date"].text==date}){day=saved}else{day=try await call("newDay",obj(["date":str(date)]))};if day["originId"].text.isEmpty{day["originId"]=value["days"].list.first?["originId"] ?? str("")};restoreDistance();try await summaries()}
    func summaries()async throws {packing=try await call("packing",obj(["day":day,"state":state]));labels=try await call("labels",obj(["state":state]))}
    func save(_ action:String,_ payload:J)async throws {let result=try await call("save",obj(["action":str(action),"payload":payload,"revision":state["revision"]]));state=result;try await summaries()}
    func saveDay(_ value:J)async throws {try await save("day",value);day=state["days"].list.first{$0["date"].text==value["date"].text} ?? value;dirty=false;live = .null;try await summaries();await syncTracking()}
    func edit(_ values:[String:J])async throws {day=try await call("edit",obj(["day":day,"change":obj(values)]));dirty=true;live = .null;try await summaries()}
    func chooseDate(_ date:String)async throws {guard !dirty else{throw NSError(domain:"步送",code:1,userInfo:[NSLocalizedDescriptionKey:"先保存当前配送单再切换日期"])};if let saved=state["days"].list.first(where:{$0["date"].text==date}){day=saved}else{day=try await call("newDay",obj(["date":str(date)])).setting("originId",day["originId"])};live = .null;restoreDistance();try await summaries()}
    var customers:[J] {state["customers"].list}
    var buildings:[J] {state["buildings"].list}
    func customer(_ id:String)->J {customers.first{$0.id==id} ?? .null}
    func building(_ id:String)->J {buildings.first{$0.id==id} ?? .null}
    func label(_ id:String)->String {labels[id].text.isEmpty ? building(id)["name"].text:labels[id].text}
    var pending:[J] {day["plan"]["stops"].list.filter{!$0["completed"].flag}.map{s in s.setting("customers",.array(s["customers"].list.filter{!$0["delivered"].flag}))}.filter{!$0["customers"].list.isEmpty}}
    var displayStops:[J] {fresh && live.exists ? live["stops"].list:pending}
    var fresh:Bool {position.exists && Date().timeIntervalSince1970*1000-position["timestamp"].double<45000}
    func eta(_ stop:J)->String {let seconds=stop["arrivalSeconds"].double;let start:Date;if fresh && live.exists {start=Date(timeIntervalSince1970:live["baseAt"].double/1000)}else if let date=ISO8601DateFormatter().date(from:day["startedAt"].text){start=date}else{let f=DateFormatter();f.locale=Locale(identifier:"en_US_POSIX");f.timeZone=TimeZone(identifier:"Europe/London");f.dateFormat="yyyy-MM-dd HH:mm";start=f.date(from:day["date"].text+" "+day["departure"].text) ?? Date()};let f=DateFormatter();f.timeZone=TimeZone(identifier:"Europe/London");f.dateFormat="HH:mm";return f.string(from:start.addingTimeInterval(seconds))}
    func plan()async throws {let result=try await call("plan",obj(["day":day,"buildings":state["buildings"],"customers":state["customers"],"position":fresh ? position:.null]));try await saveDay(day.setting("plan",result).setting("needsReplan",.bool(false)))}
    func depart()async throws {if !day["plan"].exists || day["needsReplan"].flag {try await plan()};let value=try await call("start",obj(["day":day]));try await saveDay(value);restoreDistance();startLocation()}
    func delivered(_ ids:[String],_ done:Bool=true)async throws {let value=try await call("delivered",obj(["day":day,"ids":.array(ids.map(str)),"done":.bool(done)]));try await saveDay(value)}
    func next()async throws {let value=try await call("next",obj(["day":day]));try await saveDay(value);restoreDistance()}
    func finish()async throws {guard pending.isEmpty,!day["needsReplan"].flag else{throw NSError(domain:"步送",code:1,userInfo:[NSLocalizedDescriptionKey:"请先送完所有顾客并更新路线"])};var value=day;value["finishedAt"]=str(ISO8601DateFormatter().string(from:Date()));value["walkMetres"]=distance["metres"];value["walkSamples"]=distance["samples"];value["walkGaps"]=distance["gaps"];try await saveDay(value);stopLocation()}
    func startLocation(){tracking=true;manager.requestWhenInUseAuthorization();locationManagerDidChangeAuthorization(manager)}
    func stopLocation(){tracking=false;manager.stopUpdatingLocation();UIApplication.shared.isIdleTimerDisabled=false;position = .null;live = .null;locationMessage="定位已关闭"}
    func locationManagerDidChangeAuthorization(_ manager:CLLocationManager){guard tracking else{return};switch manager.authorizationStatus{case .authorizedAlways,.authorizedWhenInUse:manager.startUpdatingLocation();UIApplication.shared.isIdleTimerDisabled=true;locationMessage="正在获取位置…";case .denied,.restricted:locationMessage="定位未获授权，请在系统设置中允许";default:break}}
    func locationManager(_ manager:CLLocationManager,didFailWithError error:Error){position = .null;locationMessage="暂时无法定位，请到室外重试"}
    func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]){guard tracking,let fix=locations.last,fix.horizontalAccuracy>=0,fix.horizontalAccuracy<=60,abs(fix.timestamp.timeIntervalSinceNow)<45 else{return};guard fix.coordinate.latitude>=51.542,fix.coordinate.latitude<=51.579,fix.coordinate.longitude>=(-0.309),fix.coordinate.longitude<=(-0.253) else{locationMessage="当前位置超出 Wembley Park 离线地图范围";position = .null;return};guard Date().timeIntervalSince(lastFix)>10 else{return};lastFix=Date();position=obj(["lat":num(fix.coordinate.latitude),"lng":num(fix.coordinate.longitude),"accuracy":num(fix.horizontalAccuracy),"timestamp":num(fix.timestamp.timeIntervalSince1970*1000)]);locationMessage="定位精度约 \(Int(fix.horizontalAccuracy)) 米";Task{do{if day["startedAt"].exists && !day["finishedAt"].exists {distance=try await call("distance",obj(["state":distance,"fix":position]));UserDefaults.standard.set(distance.json,forKey:distanceKey)};await updateRemaining()}catch{handle(error)}}}
    var distanceKey:String {"walking:"+day["date"].text+":"+day["startedAt"].text}
    func restoreDistance(){distance=obj(["metres":day["walkMetres"].exists ? day["walkMetres"]:num(0),"samples":num(0),"gaps":.bool(false)]);if day["startedAt"].exists,!day["finishedAt"].exists,let text=UserDefaults.standard.string(forKey:distanceKey),let saved=try? J.parse(text){distance=saved.setting("gaps",.bool(true))};if day["startedAt"].exists && !day["finishedAt"].exists && day["date"].text==londonDate(){startLocation()}else{stopLocation()}}
    func updateRemaining()async {guard fresh,!calculating,!pending.isEmpty else{return};calculating=true;defer{calculating=false};do{live=try await call("remaining",obj(["day":day,"position":position,"returnTo":building(day["originId"].text)]));await syncTracking()}catch{live = .null;locationMessage="ETA 更新失败，暂显示原计划时间"}}
    func syncTracking()async {guard ready,!syncBusy,!demo else{return};syncBusy=true;defer{syncBusy=false};do{let stops=live["stops"].list.map{obj(["id":$0["building"]["id"],"seconds":$0["arrivalSeconds"]])};let payload=obj(["position":fresh ? position:.null,"live":fresh && live.exists ? obj(["baseAt":live["baseAt"],"stops":.array(stops)]):.null]);let result=try await call("tracking",payload);trackingURL=result["url"].text;trackingMessage="顾客查询页已同步"}catch{trackingMessage="同步失败，将自动重试"}}
    @objc func background(){manager.stopUpdatingLocation();UIApplication.shared.isIdleTimerDisabled=false;position = .null;live = .null;distance["gaps"] = .bool(true)}
    @objc func foreground(){if tracking{manager.startUpdatingLocation();UIApplication.shared.isIdleTimerDisabled=true};Task{await syncTracking()}}
    func loadDemo(){ready=true;connected=true;let b=obj(["id":str("b"),"name":str("Brookline Building · Fulton & Fifth"),"address":str("49 Fulton Road"),"lat":num(51.5605),"lng":num(-0.275)]);let c=obj(["id":str("c"),"name":str("演示顾客"),"phone":str("07700900001"),"buildingId":str("b"),"note":str("带饮料")]);let stop=obj(["building":b,"customers":.array([c.setting("quantity",num(2))]),"arrivalSeconds":num(240),"walkSeconds":num(240),"completed":.bool(false)]);let plan=obj(["stops":.array([stop]),"geometry":.array([]),"totalSeconds":num(360),"distance":num(420)]);day=obj(["date":str(londonDate()),"departure":str("18:30"),"originId":str("b"),"speed":num(4.5),"orders":.array([obj(["customerId":str("c"),"quantity":num(2)])]),"plan":plan]);state=obj(["revision":num(0),"customers":.array([c]),"buildings":.array([b]),"days":.array([day]),"menus":.array([obj(["date":str(londonDate()),"dishes":.array([obj(["name":str("红烧肉")]),obj(["name":str("清炒豆角")])])])])]);packing=obj(["bottles":num(2),"drinks":.array([obj(["id":str("c"),"name":str("演示顾客"),"bottles":num(2)])]),"cash":.array([])])}
}
struct SessionWeb:UIViewRepresentable {let store:NativeStore;func makeUIView(context:Context)->WKWebView{store.web};func updateUIView(_ view:WKWebView,context:Context){}}
