import AppKit

/// 表情记录保留在面板内；符号大全可指定本机存储键，最多保存 28 项。
struct MacEmojiRecents {
  private(set) var items: [MacEmojiCatalogItem] = []
  private(set) var revision = 0
  private let storageKey: String?
  private let defaults: UserDefaults

  init(storageKey: String? = nil, defaults: UserDefaults = .standard) {
    self.storageKey = storageKey
    self.defaults = defaults
    if let storageKey, let rows = defaults.array(forKey: storageKey) as? [[String: String]] {
      var seen = Set<String>()
      items = Array(rows.compactMap { row in
        guard let text = row["text"], !text.isEmpty, text.utf16.count <= 4096,
              !text.contains("\u{0}"), seen.insert(text).inserted else { return nil }
        return MacEmojiCatalogItem(text: text, annotation: row["annotation"] ?? "", group: row["group"] ?? "")
      }.prefix(28))
    }
  }

  mutating func clear() {
    items = []
    revision += 1
    persist()
  }

  private func persist() {
    guard let storageKey else { return }
    defaults.set(items.map { ["text": $0.text, "annotation": $0.annotation, "group": $0.group] }, forKey: storageKey)
  }

  mutating func recordSelection(_ item: MacEmojiCatalogItem) {
    items.removeAll { $0.text == item.text }
    items.insert(item, at: 0)
    if items.count > 28 { items.removeLast(items.count - 28) }
    revision += 1
    persist()
  }

  func matching(_ search: String) -> [MacEmojiCatalogItem] {
    guard !search.isEmpty else { return items }
    return items.filter {
      $0.text.localizedCaseInsensitiveContains(search) ||
      $0.annotation.localizedCaseInsensitiveContains(search) ||
      $0.group.localizedCaseInsensitiveContains(search)
    }
  }
}

enum MacEmojiClipboard {
  static func copy(_ text: String, to pasteboard: NSPasteboard = .general) -> Bool {
    guard !text.isEmpty, text.utf16.count <= 4096 else { return false }
    pasteboard.clearContents()
    return pasteboard.setString(text, forType: .string)
  }
}
