import Combine
import Foundation

final class InstallationFixture: @unchecked Sendable {
  static let shared = InstallationFixture()
  private let condition = NSCondition()
  private var blocked = false
  private var released = false
  private var registered = false
  private var cancelled = false
  private(set) var calls = 0
  var holdRegistration = false
  var holdCompletion = false

  func install(progress: (String, UInt64, UInt64) -> Void) throws {
    condition.lock()
    calls += 1
    if holdRegistration {
      blocked = true
      condition.broadcast()
      while !released { condition.wait() }
    }
    registered = true
    condition.unlock()
    progress("download", 0, 100)
    condition.lock()
    if holdCompletion {
      blocked = true
      condition.broadcast()
      while !released { condition.wait() }
    }
    let stopped = cancelled
    registered = false
    condition.unlock()
    throw IOSResourcePacks.Failure(code: stopped ? "local_model_cancelled" : "synthetic_cancel_lost")
  }

  func prepareRetry() {
    condition.lock()
    cancelled = false
    holdRegistration = false
    holdCompletion = false
    condition.unlock()
  }

  func cancel() {
    condition.lock()
    if registered { cancelled = true }
    condition.unlock()
  }

  func waitForWorker() {
    condition.lock()
    while !blocked { condition.wait() }
    condition.unlock()
  }

  func releaseWorker() {
    condition.lock()
    released = true
    condition.broadcast()
    condition.unlock()
  }
}

enum IOSResourcePacks {
  struct Pack { let id: String; let size: Int; let installed: Bool }
  struct Failure: Error { let code: String }
  static func bundled(_ id: String) -> Bool { false }
  static func list() throws -> [Pack] { [] }
  static func install(_ id: String, progress: @escaping (String, UInt64, UInt64) -> Void) throws {
    try InstallationFixture.shared.install(progress: progress)
  }
  static func cancel(_ id: String) { InstallationFixture.shared.cancel() }
}

enum InputSchemePreference {
  static func refreshResourceAvailability() {}
}

@MainActor
final class ToastCenter {
  static let shared = ToastCenter()
  func show(_ message: String) {}
}

@main
struct IOSResourcePackCancellationTests {
  @MainActor
  static func main() async {
    let fixture = InstallationFixture.shared
    fixture.holdRegistration = CommandLine.arguments.contains("registration")
    fixture.holdCompletion = CommandLine.arguments.contains("registered")
    let store = IOSResourcePackStore()
    let (events, continuation) = AsyncStream<String>.makeStream()
    let subscription = store.$statuses.sink { statuses in
      if let phase = statuses["japanese"]?.phase, ["failed", "cancelled"].contains(phase) {
        continuation.yield(phase)
      }
    }
    defer { subscription.cancel() }
    store.start("japanese")
    if fixture.holdRegistration || fixture.holdCompletion {
      await Task.detached { fixture.waitForWorker() }.value
    }
    store.cancel("japanese")
    fixture.releaseWorker()
    var iterator = events.makeAsyncIterator()
    let result = await iterator.next()
    guard result == "cancelled" else {
      print("取消请求丢失：期望 cancelled，实际 \(result ?? "无结果")")
      exit(1)
    }
    if !fixture.holdRegistration && !fixture.holdCompletion && fixture.calls != 0 {
      print("工作线程启动前取消仍然调用了安装器")
      exit(1)
    }
    let calls = fixture.calls
    fixture.prepareRetry()
    store.start("japanese")
    let retried = await iterator.next()
    guard retried == "failed", fixture.calls == calls + 1 else {
      print("重试复用了旧取消状态，或未调用新安装器")
      exit(1)
    }
    print("资源包取消及重试回归通过：\(CommandLine.arguments.last ?? "")")
  }
}
