import XCTest
@testable import FoodDelivery
final class AppPolicyTests: XCTestCase {
    func testTrustExactHTTPSOriginOnly() {
        XCTAssertTrue(AppPolicy.isTrusted(AppPolicy.home))
        XCTAssertTrue(AppPolicy.isTrusted(URL(string: "https://wembley-walk-delivery.superxin24.chatgpt.site/api/state")))
        for value in ["http://wembley-walk-delivery.superxin24.chatgpt.site", "https://evil.example", "https://wembley-walk-delivery.superxin24.chatgpt.site.evil.example", "https://wembley-walk-delivery.superxin24.chatgpt.site:8443"] {
            XCTAssertFalse(AppPolicy.isTrusted(URL(string:value)))
        }
        XCTAssertFalse(AppPolicy.isTrusted(nil))
    }
    func testDialOnlyExpectedSchemes() {
        XCTAssertTrue(AppPolicy.externalScheme(URL(string:"tel:07700900001")!))
        XCTAssertFalse(AppPolicy.externalScheme(URL(string:"javascript:alert(1)")!))
        XCTAssertFalse(AppPolicy.externalScheme(AppPolicy.home))
    }
    func testBridgeBundled() {
        XCTAssertNotNil(Bundle.main.url(forResource:"bridge",withExtension:"js"))
    }
}
