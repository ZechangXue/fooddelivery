import XCTest
import WebKit
@testable import FoodDelivery

@MainActor final class EngineTests: XCTestCase, WKNavigationDelegate {
    private var loaded: XCTestExpectation?
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded?.fulfill(); loaded=nil }
    func testBundledEngineInWebKit() async throws {
        let web=WKWebView()
        web.navigationDelegate=self
        let navigation=expectation(description:"Local engine host")
        loaded=navigation
        web.loadHTMLString("<html><body></body></html>", baseURL:AppPolicy.home)
        await fulfillment(of:[navigation],timeout:15)
        let source=try String(contentsOf:Bundle.main.url(forResource:"engine",withExtension:"js")!)
        let worker=try String(contentsOf:Bundle.main.url(forResource:"routeWorker",withExtension:"js")!)
        _ = try await web.evaluateJavaScript("window.deliveryWorkerSource="+str(worker).json+";"+source)
        let script=#"""
        const run=window.deliveryEngine.run;
        const b={id:'b',name:'Brookline',address:'49 Fulton Road',lat:51.5605,lng:-0.275};
        const c={id:'c',name:'Test Customer',phone:'07700900001',buildingId:'b',note:'带饮料；现金（带7磅零钱）'};
        const state={revision:0,buildings:[b],customers:[c],days:[],menus:[]};
        const day=await run('newDay',{date:'2026-11-12'});
        day.originId='b';day.orders=[{customerId:'c',quantity:2}];
        const packing=await run('packing',{state,day});
        const menu=await run('menu',{date:day.date,text:'红烧肉 + 炖排骨 + 西葫芦炒蛋'});
        const plan=await run('plan',{state,day,buildings:state.buildings,customers:state.customers});
        const parsed=await run('parse',{state,text:'发送人 (昵称):\nTrevor 07700900002 Brookline\n\n发送人 (昵称):\nScape Wembley, Jamie, 07700900003 - 带饮料'});
        return JSON.stringify({packing,menu,plan,parsed});
        """#
        let raw=try await web.callAsyncJavaScript(script,arguments:[:],in:nil,contentWorld:.page)
        let result=try J.parse(try XCTUnwrap(raw as? String))
        XCTAssertEqual(result["packing"]["bottles"].int,2)
        XCTAssertEqual(result["packing"]["cash"].list.count,1)
        XCTAssertEqual(result["menu"]["dishes"].list.count,3)
        XCTAssertEqual(result["plan"]["stops"].list.count,1)
        XCTAssertGreaterThanOrEqual(result["plan"]["totalSeconds"].double,120)
        XCTAssertEqual(result["parsed"].list.count,2)
        XCTAssertEqual(result["parsed"].list.first?["name"].text,"Trevor")
        XCTAssertEqual(result["parsed"].list.last?["name"].text,"Jamie")
    }
}
