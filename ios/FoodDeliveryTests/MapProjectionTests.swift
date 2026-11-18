import XCTest
@testable import FoodDelivery
final class MapProjectionTests:XCTestCase {
    func testEqualGroundDistancesStayEqualInWideAndTallMaps() {
        for size in [CGSize(width:350,height:180),CGSize(width:350,height:320),CGSize(width:390,height:700)] {
            let p=MapProjection(points:[],size:size)
            let c=p.point(-0.28,51.56)
            let east=p.point(-0.28+100/MapProjection.longitudeMetres,51.56)
            let north=p.point(-0.28,51.56+100/111195)
            XCTAssertEqual(east.x-c.x,c.y-north.y,accuracy:0.0001)
        }
    }
    func testZoomedAndPannedTapRoundTrips() {
        let p=MapProjection(points:[CGPoint(x:-0.28,y:51.56)],size:CGSize(width:350,height:320),zoom:3,offset:CGSize(width:37,height:-81))
        let recovered=p.coordinate(p.point(-0.278,51.561))
        XCTAssertEqual(recovered.x,-0.278,accuracy:0.000001)
        XCTAssertEqual(recovered.y,51.561,accuracy:0.000001)
    }
    func testRouteFitsInsidePadding() {
        let points=[CGPoint(x:-0.29,y:51.55),CGPoint(x:-0.27,y:51.565)]
        let p=MapProjection(points:points,size:CGSize(width:350,height:320))
        for c in points {let q=p.point(c.x,c.y);XCTAssertGreaterThanOrEqual(q.x,43.9);XCTAssertLessThanOrEqual(q.x,306.1);XCTAssertGreaterThanOrEqual(q.y,43.9);XCTAssertLessThanOrEqual(q.y,276.1)}
    }
}
