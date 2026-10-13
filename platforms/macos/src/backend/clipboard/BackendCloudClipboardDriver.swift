import Foundation

/// 输入法进程交给后端 dylib 的云剪贴板端到端加密驱动。dylib 不链接 Rust 库，`msime_client_cloud_clipboard_e2e` 和 `msime_client_string_free` 链接在输入法可执行文件里；`input_method_main.mm` 在加载 dylib 之后立刻经 `MSIMEInstallCloudClipboardDriver` 把两个函数指针交过来，输入法和独立设置窗口两种启动方式都会走到这一步。
enum MacCloudClipboardDriver {
  typealias Drive = @convention(c) (UnsafePointer<UInt8>?, Int) -> UnsafeMutablePointer<CChar>?
  typealias Free = @convention(c) (UnsafeMutablePointer<CChar>?) -> Void

  private final class Installed: @unchecked Sendable {
    let lock = NSLock()
    var functions: (drive: Drive, free: Free)?
  }
  private static let installed = Installed()

  static func install(drive: @escaping Drive, free: @escaping Free) {
    installed.lock.lock(); defer { installed.lock.unlock() }
    installed.functions = (drive, free)
  }

  /// 本进程的驱动、密钥串（与 `account-session.json` 同目录的 `cloud-clipboard-keystore`）和设备名；输入法没有交来驱动时为 nil，此时云剪贴板的读写都会失败，而不是退回明文。
  static var e2e: BackendClipboardE2E? {
    installed.lock.lock()
    let functions = installed.functions
    installed.lock.unlock()
    guard let functions else { return nil }
    return BackendClipboardE2E(drive: BackendClipboardE2E.callingCABI({ functions.drive($0, $1) }, free: { functions.free($0) }),
                               keystore: BackendDesktopClipboardKeystoreFile(), deviceName: { deviceName })
  }

  /// 「系统设置 → 通用 → 关于本机」里的电脑名称，取不到时用「Mac」。只在登记本机时发给服务端，其他设备在设备列表里看到它。
  static var deviceName: String {
    let name = Host.current().localizedName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return name.isEmpty ? "Mac" : name
  }
}

/// 由 `input_method_main.mm` 在 `dlopen` 后用 `dlsym` 找到并调用，所以必须是导出的全局符号。任一参数为空时不安装。
@_cdecl("MSIMEInstallCloudClipboardDriver")
public func msimeInstallCloudClipboardDriver(
  _ drive: (@convention(c) (UnsafePointer<UInt8>?, Int) -> UnsafeMutablePointer<CChar>?)?,
  _ free: (@convention(c) (UnsafeMutablePointer<CChar>?) -> Void)?
) {
  guard let drive, let free else { return }
  MacCloudClipboardDriver.install(drive: drive, free: free)
}
