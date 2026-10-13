import Foundation

/// 驱动的替身：列表、条目和设备状态都按驱动的结果形状给出。`failure` 设了时驱动操作一律以它失败，模拟驱动的错误码。
@MainActor final class SyntheticClipboardAPI: DesktopCloudClipboardAPI {
  var calls = 0
  var uploaded = ""
  var failure: BackendAccountClient.Failure?
  var operations: [BackendAccountClient.ClipboardE2EOperation] = []
  static let devices: [String: Any] = ["enabled": true, "status": "ready", "device_id": String(repeating: "a", count: 32),
    "code": "0421 9873 5530 1176", "devices": [
      ["device_id": String(repeating: "a", count: 32), "name": "合成 Mac", "created_at": "2026-10-11T08:00:00Z", "approved": true, "current": true, "code": "0421 9873 5530 1176"],
      ["device_id": String(repeating: "b", count: 32), "name": "合成 iPhone", "created_at": "2026-10-11T09:00:00Z", "approved": false, "current": false, "code": "1111 2222 3333 4444"],
    ]]
  func clipboardE2EObject(_ operation: BackendAccountClient.ClipboardE2EOperation, token: String,
                          e2e: BackendClipboardE2E?) async throws -> [String: Any] {
    calls += 1
    operations.append(operation)
    if let failure { throw failure }
    switch operation {
    case .list:
      return ["enabled": true, "retention_days": 7, "items": [["id": String(repeating: "a", count: 64), "text": "synthetic\n\t合成",
        "updated_at": "synthetic-time", "pinned": true, "device": "合成 iPhone"]],
        "e2e": ["status": "ready", "code": "0421 9873 5530 1176", "pending_devices": 1, "undecryptable": 0]]
    case .add(let text):
      uploaded = text
      return ["id": String(repeating: "a", count: 64), "text": text, "updated_at": "synthetic-time", "pinned": false, "device": "合成 Mac"]
    case .status, .approve, .reject, .remove, .reset:
      return Self.devices
    }
  }
  func deleteClipboard(id: String?, token: String) async throws { calls += 1; assert(id?.count == 64) }
  func setClipboardEnabled(_ enabled: Bool, token: String) async throws { calls += 1; assert(!enabled) }
}

@MainActor final class RetryingClipboardAPI: DesktopCloudClipboardAPI {
  var calls = 0
  var rejectEveryCall = false
  func clipboardE2EObject(_ operation: BackendAccountClient.ClipboardE2EOperation, token: String,
                          e2e: BackendClipboardE2E?) async throws -> [String: Any] {
    calls += 1
    if case .add = operation { throw BackendAccountClient.Failure(status: 500) }
    if calls == 1 || rejectEveryCall { throw BackendAccountClient.Failure(status: 401, code: "invalid_credentials") }
    assert(token == "fresh-token")
    return ["enabled": true, "retention_days": 0, "items": []]
  }
  func deleteClipboard(id: String?, token: String) async throws { calls += 1 }
  func setClipboardEnabled(_ enabled: Bool, token: String) async throws { calls += 1 }
}

@main enum DesktopCloudClipboardProviderTest {
  @MainActor static func main() async throws {
    let api = SyntheticClipboardAPI()
    let provider = BackendCloudClipboardProvider(client: api, credentials: { "synthetic-token" })
    let page = try await provider.execute(["operation":"list", "search":"合成"])
    // 列表原样转发驱动的形状：条目带置顶和设备名，另有保留期和端到端加密状态。
    let listed = (page["items"] as? [[String: Any]])?.first
    assert((page["items"] as? [[String: Any]])?.count == 1 && listed?["pinned"] as? Bool == true && listed?["device"] as? String == "合成 iPhone")
    assert(page["retention_days"] as? Int == 7 && (page["e2e"] as? [String: Any])?["pending_devices"] as? Int == 1)
    assert(api.operations.first == .list(search: "合成"))
    let text = String(repeating: "界", count: 3997) + "\n\r\t"
    _ = try await provider.execute(["operation":"add", "text":text])
    assert(api.uploaded == text)
    _ = try await provider.execute(["operation":"delete", "id":String(repeating: "a", count: 64)])
    _ = try await provider.execute(["operation":"set_enabled", "enabled":false])
    assert(api.calls == 4)
    _ = try await provider.execute(["operation":"add", "text":"👩‍💻"])
    assert(api.uploaded == "👩‍💻")
    _ = try await provider.execute(["operation":"list", "search":"👩‍💻"])
    for request: NSDictionary in [
      ["operation":"add", "text":String(repeating: "界", count: 4001)],
      ["operation":"add", "text":"synthetic\0"], ["operation":"list", "search":"bad\n"],
      ["operation":"add", "text":"synthetic\u{0085}"],
      ["operation":"delete", "id":"bad/id"], ["operation":"set_enabled", "enabled":1],
      ["operation":"token"], ["operation":"approve"], ["operation":"reject", "device_id":"../keys"],
      ["operation":"remove", "device_id":String(repeating: "A", count: 32)],
    ] {
      do { _ = try await provider.execute(request); assertionFailure("invalid action accepted") } catch { }
    }
    assert(api.calls == 6)
    // 设备相关的五个动作经驱动，结果都是驱动的设备状态形状。
    let other = String(repeating: "b", count: 32)
    for (request, operation): (NSDictionary, BackendAccountClient.ClipboardE2EOperation) in [
      (["operation":"devices"], .status), (["operation":"approve", "device_id":other], .approve(deviceID: other)),
      (["operation":"reject", "device_id":other], .reject(deviceID: other)), (["operation":"remove", "device_id":other], .remove(deviceID: other)),
      (["operation":"reset"], .reset),
    ] {
      let status = try await provider.execute(request)
      assert(api.operations.last == operation)
      assert(status["status"] as? String == "ready" && (status["devices"] as? [[String: Any]])?.count == 2)
    }
    assert(api.calls == 11)
    // 驱动的错误码原样交给面板，本地校验不过是 invalid，其余是 unavailable。
    api.failure = BackendAccountClient.Failure(status: 0, code: "clipboard_device_pending")
    let pendingReply: NSDictionary = await withCheckedContinuation { continuation in
      _ = provider.request(["operation":"add", "text":"synthetic"], completion: { continuation.resume(returning: $0) })
    }
    assert(pendingReply["ok"] as? Bool == false && pendingReply["error"] as? String == "clipboard_device_pending" && pendingReply["status"] as? Int == 0)
    api.failure = BackendAccountClient.Failure(status: 409, code: "clipboard_key_conflict")
    let conflictReply: NSDictionary = await withCheckedContinuation { continuation in
      _ = provider.request(["operation":"reset"], completion: { continuation.resume(returning: $0) })
    }
    assert(conflictReply["error"] as? String == "clipboard_key_conflict" && conflictReply["status"] as? Int == 409)
    api.failure = nil
    let invalidReply: NSDictionary = await withCheckedContinuation { continuation in
      _ = provider.request(["operation":"approve", "device_id":"bad"], completion: { continuation.resume(returning: $0) })
    }
    assert(invalidReply["error"] as? String == "invalid" && invalidReply["status"] as? Int == 400)
    assert(api.calls == 13)
    var identities = 0
    let changed = BackendCloudClipboardProvider(client: api, credentials: {
      identities += 1
      if identities > 1 { throw CancellationError() }
      return "synthetic-token"
    })
    do { _ = try await changed.execute(["operation":"list"]); assertionFailure("old account data exposed") } catch { }
    let before = api.calls
    let missing = BackendCloudClipboardProvider(client: api, credentials: { throw CancellationError() })
    do { _ = try await missing.execute(["operation":"add", "text":"synthetic"]); assertionFailure("signed-out mutation") } catch { }
    assert(api.calls == before)
    let response: NSDictionary = await withCheckedContinuation { continuation in
      let progress = provider.request(["operation":"add", "text":"synthetic"], completion: { continuation.resume(returning: $0) })
      progress.cancel()
    }
    assert(response["ok"] as? Bool == false && api.calls == before)
    assert(response["error"] as? String == "unavailable")

    let retryAPI = RetryingClipboardAPI()
    var refreshes = 0
    var currentToken = "stale-token"
    let retrying = BackendCloudClipboardProvider(client: retryAPI, credentials: { currentToken },
                                                  refreshCredentials: { rejected in
      assert(rejected == "stale-token")
      refreshes += 1
      currentToken = "fresh-token"
      return "fresh-token"
    })
    _ = try await retrying.execute(["operation":"list", "search":"合成"])
    assert(retryAPI.calls == 2 && refreshes == 1)

    let persistentAPI = RetryingClipboardAPI()
    persistentAPI.rejectEveryCall = true
    var persistentRefreshes = 0
    let persistent = BackendCloudClipboardProvider(client: persistentAPI, credentials: { "stale-token" },
                                                   refreshCredentials: { _ in
      persistentRefreshes += 1
      return "fresh-token"
    })
    do {
      _ = try await persistent.execute(["operation":"list"])
      assertionFailure("a second 401 must fail")
    } catch let failure as BackendAccountClient.Failure {
      assert(failure.status == 401)
    }
    assert(persistentAPI.calls == 2 && persistentRefreshes == 1)

    let switchedAPI = RetryingClipboardAPI()
    var switchedRefreshes = 0
    let switched = BackendCloudClipboardProvider(client: switchedAPI, credentials: { "stale-token" },
                                                 refreshCredentials: { _ in
      switchedRefreshes += 1
      throw CancellationError()
    })
    do {
      _ = try await switched.execute(["operation":"list"])
      assertionFailure("an account switch must stop the retry")
    } catch is CancellationError { }
    assert(switchedAPI.calls == 1 && switchedRefreshes == 1)

    // Sending a local history entry goes straight to the driver, which reads the server flag and this device's approval first; a switched-off clipboard or a pending device uploads nothing.
    let sending = SyntheticClipboardAPI()
    let sender = BackendCloudClipboardProvider(client: sending, credentials: { "synthetic-token" })
    let sent = await sender.send("synthetic\n合成")
    assert(sent == .sent && sending.uploaded == "synthetic\n合成" && sending.calls == 1)
    sending.uploaded = ""
    sending.failure = BackendAccountClient.Failure(status: 403, code: "clipboard_sync_disabled")
    let disabled = await sender.send("synthetic")
    assert(disabled == .disabled && sending.uploaded.isEmpty && sending.calls == 2)
    sending.failure = BackendAccountClient.Failure(status: 0, code: "clipboard_device_pending")
    let pending = await sender.send("synthetic")
    assert(pending == .pending && sending.uploaded.isEmpty && sending.calls == 3)
    sending.failure = nil
    let rejected = await sender.send("synthetic\0")
    assert(rejected == .failed && sending.uploaded.isEmpty && sending.calls == 3)
    let signedOut = BackendCloudClipboardProvider(client: sending, credentials: { throw CancellationError() })
    let unauthenticated = await signedOut.send("synthetic")
    assert(unauthenticated == .failed && sending.calls == 3)
    assert(BackendCloudClipboardProvider.SendOutcome.signedOut.message == "登录水杉账号后可在设备间同步剪贴板")
    assert(BackendCloudClipboardProvider.SendOutcome.disabled.message == "云剪贴板未开启")
    assert(BackendCloudClipboardProvider.SendOutcome.pending.message.contains("等待批准"))
    // 没有驱动时不会退回明文：真实客户端在发出任何请求前就失败。
    let noDriver = BackendCloudClipboardProvider(client: BackendAccountClient(), e2e: nil, credentials: { "synthetic-token" })
    do { _ = try await noDriver.execute(["operation":"list"]); assertionFailure("listed without a driver") }
    catch let failure as BackendAccountClient.Failure { assert(failure.status == 0) }
  }
}
