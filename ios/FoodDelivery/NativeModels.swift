import Foundation

indirect enum J: Codable, Equatable, Hashable, Identifiable {
    case object([String:J]), array([J]), string(String), number(Double), bool(Bool), null
    init(from decoder: Decoder) throws { let c = try decoder.singleValueContainer(); if c.decodeNil(){self = .null} else if let v = try? c.decode(Bool.self){self = .bool(v)} else if let v = try? c.decode(Double.self){self = .number(v)} else if let v = try? c.decode(String.self){self = .string(v)} else if let v = try? c.decode([J].self){self = .array(v)} else {self = .object(try c.decode([String:J].self))} }
    func encode(to encoder: Encoder) throws { var c=encoder.singleValueContainer();switch self {case .object(let v):try c.encode(v);case .array(let v):try c.encode(v);case .string(let v):try c.encode(v);case .number(let v):try c.encode(v);case .bool(let v):try c.encode(v);case .null:try c.encodeNil()} }
    subscript(_ key:String)->J { get {if case .object(let v)=self{return v[key] ?? .null};return .null} set {var v=dict;v[key]=newValue;self = .object(v)} }
    var dict:[String:J] {if case .object(let v)=self{return v};return [:]}
    var list:[J] {if case .array(let v)=self{return v};return []}
    var text:String {if case .string(let v)=self{return v};return ""}
    var double:Double {if case .number(let v)=self{return v};return 0}
    var int:Int {Int(double)}
    var flag:Bool {if case .bool(let v)=self{return v};return false}
    var exists:Bool {self != .null}
    var id:String {self["id"].text.isEmpty ? self["key"].text : self["id"].text}
    var json:String {String(data:(try? JSONEncoder().encode(self)) ?? Data("null".utf8),encoding:.utf8)!}
    static func parse(_ text:String)throws->J {try JSONDecoder().decode(J.self,from:Data(text.utf8))}
    func setting(_ key:String,_ value:J)->J {var copy=self;copy[key]=value;return copy}
}
func obj(_ values:[String:J])->J {.object(values)}
func str(_ value:String)->J {.string(value)}
func num(_ value:Double)->J {.number(value)}
func londonDate(_ date:Date=Date())->String {let f=DateFormatter();f.timeZone=TimeZone(identifier:"Europe/London");f.locale=Locale(identifier:"en_US_POSIX");f.dateFormat="yyyy-MM-dd";return f.string(from:date)}
func dateValue(_ value:String)->Date {ISO8601DateFormatter().date(from:value+"T12:00:00Z") ?? Date()}
func weekday(_ value:String)->String {let f=DateFormatter();f.locale=Locale(identifier:"zh_CN");f.timeZone=TimeZone(identifier:"Europe/London");f.dateFormat="EEEE";return f.string(from:dateValue(value))}
func totalBoxes(_ day:J)->Int {(day["previousTrips"].list+[day]).reduce(0){$0+$1["orders"].list.reduce(0){$0+$1["quantity"].int}}}
