import Foundation

struct MacEmojiSymbolGroup: Hashable, Sendable {
  let parent: String
  let title: String

  static func displayTitle(_ title: String) -> String {
    let titles = [
      "Stars and shapes": "特殊符号",
      "Arrows and lines": "箭头与线条",
      "Punctuation": "标点符号",
      "Math": "数学与序号",
      "Currency": "货币与单位",
      "Hearts": "爱心与表情",
      "Letters": "字母与文字",
      "Games": "游戏符号",
      "Culture": "文化符号",
      "Animals and nature": "动物与自然",
      "People and activity": "人物与活动",
      "More": "更多符号",
      "Stars": "星形",
      "Asterisks": "星号",
      "Circles": "圆形",
      "Triangles": "三角形",
      "Squares": "方形",
      "Other shapes": "其他形状",
      "Bullet points": "项目符号",
      "Arrows": "箭头",
      "Lines": "线条",
      "Random lines": "制表线条",
      "Brackets": "括号",
      "Quotation marks": "引号",
      "Pilcrow": "段落标记",
      "Check marks": "勾选符号",
      "X marks": "叉号",
      "Numbers": "数字序号",
      "Fractions": "分数",
      "Pi": "圆周率",
      "Super/subscripts": "上标与下标",
      "Business": "商业符号",
      "Units": "单位符号",
      "Eyes": "眼睛",
      "Monochrome": "单色表情",
      "Latin letters": "拉丁字母",
      "Latin extended": "扩展拉丁字母",
      "Greek letters": "希腊字母",
      "Japanese kana": "日文假名",
      "Braille": "盲文",
      "Korean": "韩文字符",
      "Card suits": "扑克牌",
      "Chess": "国际象棋",
      "Dice": "骰子",
      "Religion and culture": "宗教与文化",
      "Crosses": "十字架",
      "Zodiac": "星座",
      "Gender": "性别",
      "Totems": "图腾",
      "Animals": "动物",
      "Flowers": "花卉",
      "Weather": "天气",
      "Music": "音乐",
      "Technical": "技术符号",
      "Menu": "菜单符号",
      "Miscellaneous": "杂项符号",
      "Block elements": "块状字符",
      "Mashup": "组合符号",
    ]
    return titles[title] ?? title
  }

  static func queryFilters(search: String, parent: String, group: String) -> (parent: String, group: String) {
    search.isEmpty ? (parent, group) : ("", "")
  }

  static func parents(_ groups: [Self]) -> [String] { unique(groups.map(\.parent)) }
  static func titles(_ groups: [Self], parent: String) -> [String] {
    unique(groups.filter { parent.isEmpty || $0.parent == parent }.map(\.title))
  }
  private static func unique(_ values: [String]) -> [String] {
    var seen = Set<String>()
    return values.filter { seen.insert($0).inserted }
  }
}

/// 已安装符号集插件的一组符号，来自 `msime_client_emoji_catalog_request` 的 `list_plugin_symbol_groups`。
/// `symbols` 组以插件包为上级分类排在内置分类之后，`kaomoji` 组排在内置颜文字 All 之后；不与内置目录或其他插件包去重。
struct MacEmojiPluginSymbolGroup: Equatable, Sendable {
  enum Tab: String, Sendable { case symbols, kaomoji }
  let pack: String
  let packName: String
  let tab: Tab
  let title: String
  let keywords: String
  let items: [String]

  /// 插件目录 `<preferences_directory>/plugins`；偏好目录为空或不是绝对路径时没有插件。
  static func directory(preferencesDirectory: String) -> String? {
    guard NSString(string: preferencesDirectory).isAbsolutePath else { return nil }
    return URL(fileURLWithPath: preferencesDirectory).appendingPathComponent("plugins").path
  }

  /// 插件包在符号页的上级分类 id，显示名是 `packName`。以 NUL 开头，不会与内置上级分类重名，同名的两个包也各占一个分类。
  static func parentID(pack: String) -> String { "\u{0}plugin:" + pack }
  static func isParentID(_ parent: String) -> Bool { parent.hasPrefix("\u{0}plugin:") }

  /// 没有搜索词时给整组；有搜索词时关键词命中则给整组，否则只给文本包含搜索词的项。
  func matching(_ search: String) -> [MacEmojiCatalogItem] {
    let all = items.map { MacEmojiCatalogItem(text: $0, annotation: "", group: title) }
    guard !search.isEmpty, !keywords.localizedCaseInsensitiveContains(search) else { return all }
    return all.filter { $0.text.localizedCaseInsensitiveContains(search) }
  }

  /// 符号页一次查询里的插件项，追加在内置结果之后：有搜索词时是所有插件包 `symbols` 组的命中项，没有时只有选中插件包的组。
  static func symbolItems(_ groups: [Self], search: String, parent: String) -> [MacEmojiCatalogItem] {
    groups.filter { $0.tab == .symbols && (!search.isEmpty || parent.isEmpty || parentID(pack: $0.pack) == parent) }
      .flatMap { $0.matching(search) }
  }

  /// 颜文字页追加在 All 之后的插件分组，按组给出命中项，没有命中的组不出现。
  static func kaomojiSections(_ groups: [Self], search: String) -> [(title: String, items: [MacEmojiCatalogItem])] {
    groups.filter { $0.tab == .kaomoji }.map { (title: $0.title, items: $0.matching(search)) }.filter { !$0.items.isEmpty }
  }
}
