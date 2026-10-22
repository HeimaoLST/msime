import Foundation
import os

/// Signposts on the keystroke path, read in Instruments on the Points of Interest track. Every name is a fixed constant and the only payload is a duration in milliseconds: no key, text, candidate or document content is ever recorded. Not recording costs one enabled check per call.
enum KeyPathSignpost {
  static let signposter = OSSignposter(subsystem: "app.msime.ios.keyboard", category: .pointsOfInterest)

  /// Wraps `body` in an interval named `name`.
  @inline(__always)
  static func interval<T>(_ name: StaticString, _ body: () throws -> T) rethrows -> T {
    let state = signposter.beginInterval(name, id: signposter.makeSignpostID())
    defer { signposter.endInterval(name, state) }
    return try body()
  }

  /// Begins an interval for a whole function body; pair it with `end` in a `defer`.
  static func begin(_ name: StaticString) -> OSSignpostIntervalState {
    signposter.beginInterval(name, id: signposter.makeSignpostID())
  }

  static func end(_ name: StaticString, _ state: OSSignpostIntervalState) {
    signposter.endInterval(name, state)
  }

  /// An event carrying the milliseconds from `uptime` (the `systemUptime` clock that `UITouch.timestamp` also uses) to now.
  static func elapsed(_ name: StaticString, since uptime: TimeInterval) {
    let milliseconds = (ProcessInfo.processInfo.systemUptime - uptime) * 1_000
    signposter.emitEvent(name, "\(milliseconds, format: .fixed(precision: 2), privacy: .public)")
  }
}
