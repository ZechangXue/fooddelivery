import XCTest
final class NativeScreensTests:XCTestCase {
    func testNativeTabsAndRouteDetails() {
        let app=XCUIApplication();app.launchArguments=["--ui-testing"];app.launch()
        XCTAssertTrue(app.buttons["我出发啦"].waitForExistence(timeout:20))
        capture("01-today")
        app.tabBars.buttons["顾客与楼栋"].tap()
        XCTAssertTrue(app.staticTexts["演示顾客"].waitForExistence(timeout:5))
        capture("02-customers")
        app.tabBars.buttons["历史记录"].tap()
        XCTAssertTrue(app.staticTexts["共 2 盒"].waitForExistence(timeout:5))
        capture("03-history")
        app.tabBars.buttons["经营统计"].tap()
        XCTAssertTrue(app.staticTexts["顾客订餐排行"].waitForExistence(timeout:5))
        capture("04-statistics")
        app.tabBars.buttons["每日配送"].tap()
        let route=app.buttons.matching(NSPredicate(format:"label CONTAINS %@", "查看全部")).firstMatch
        for _ in 0..<5 {if route.exists && route.isHittable {break};app.swipeUp()}
        if route.exists {route.tap();XCTAssertTrue(app.staticTexts["今日需带 2 瓶饮料"].waitForExistence(timeout:5));capture("05-route")}
    }
    func capture(_ name:String){let attachment=XCTAttachment(screenshot:XCUIScreen.main.screenshot());attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)}
}
