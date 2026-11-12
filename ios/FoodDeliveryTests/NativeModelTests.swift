import XCTest
@testable import FoodDelivery
final class NativeModelTests:XCTestCase {
    func testJSONRoundTripAndEditableFields() throws {let value=try J.parse("{\"name\":\"测试\",\"orders\":[{\"quantity\":2}],\"active\":true}");XCTAssertEqual(value["orders"].list.first?["quantity"].int,2);XCTAssertTrue(value["active"].flag);XCTAssertEqual(try J.parse(value.json),value);XCTAssertEqual(value.setting("name",str("新名称"))["name"].text,"新名称")}
    func testDailyBoxesIncludesEveryTrip(){let a=obj(["orders":.array([obj(["quantity":num(2)])])]);let b=obj(["orders":.array([obj(["quantity":num(3)]),obj(["quantity":num(0)])]),"previousTrips":.array([a])]);XCTAssertEqual(totalBoxes(b),5)}
    func testWeekdayDoesNotDependOnDeviceTimezone(){XCTAssertEqual(weekday("2026-11-12"),"星期四")}
    func testEngineResourcesBundled(){for name in ["engine","routeWorker"]{XCTAssertNotNil(Bundle.main.url(forResource:name,withExtension:"js"))};XCTAssertNotNil(Bundle.main.url(forResource:"wembley",withExtension:"json"))}
}
