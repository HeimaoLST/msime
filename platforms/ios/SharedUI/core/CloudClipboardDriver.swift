import Foundation
import UIKit

@_silgen_name("msime_client_cloud_clipboard_e2e")
private func msimeCloudClipboardE2E(_ request: UnsafePointer<UInt8>?, _ length: Int) -> UnsafeMutablePointer<CChar>?

@_silgen_name("msime_client_string_free")
private func msimeCloudClipboardStringFree(_ value: UnsafeMutablePointer<CChar>?)

/// App 和键盘扩展共用的云剪贴板端到端加密驱动：Rust 的 `msime_client_cloud_clipboard_e2e`，密钥串存在与账号会话同一个钥匙串访问组的通用密码项里（service `app.msime.backend.account`，account `cloud-clipboard-keystore`），所以两边是同一台设备、只需批准一次。
enum IOSCloudClipboardDriver {
  static let e2e = BackendClipboardE2E(
    drive: BackendClipboardE2E.callingCABI({ msimeCloudClipboardE2E($0, $1) }, free: { msimeCloudClipboardStringFree($0) }),
    keystore: BackendKeychainClipboardKeystore(),
    deviceName: { await MainActor.run { deviceName(UIDevice.current) } })

  /// 设备名（iOS 16 起没有额外权限时就是「iPhone」「iPad」），取不到时用型号。只在登记本机时发给服务端，其他设备在设备列表里看到它。
  @MainActor static func deviceName(_ device: UIDevice) -> String {
    let name = device.name.trimmingCharacters(in: .whitespacesAndNewlines)
    return name.isEmpty ? device.model : name
  }
}
