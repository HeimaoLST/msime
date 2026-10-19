import Foundation

/// 一次下载独立保存取消意图，覆盖工作线程启动和共享任务登记之前的窗口。
final class IOSResourcePackDownload: @unchecked Sendable {
  private let id: String
  private let lock = NSLock()
  private var cancelRequested = false
  private var registered = false
  private var finished = false

  init(id: String) { self.id = id }

  func cancel() {
    lock.lock()
    defer { lock.unlock() }
    cancelRequested = true
    // 取消入口只设置共享标记，不触发回调；持锁让转发先于本次结束和下一次重试。
    if registered && !finished { IOSResourcePacks.cancel(id) }
  }

  func install(progress: @escaping (String, UInt64, UInt64) -> Void) throws {
    lock.lock()
    let cancelled = cancelRequested
    lock.unlock()
    defer {
      lock.lock()
      finished = true
      registered = false
      lock.unlock()
    }
    if cancelled { throw IOSResourcePacks.Failure(code: "local_model_cancelled") }
    try IOSResourcePacks.install(id) { [self] phase, done, total in
      // 共享层在登记后、任何 I/O 前同步发送首次进度，补发此前保存的取消。
      lock.lock()
      registered = true
      if cancelRequested { IOSResourcePacks.cancel(id) }
      lock.unlock()
      progress(phase, done, total)
    }
  }
}
