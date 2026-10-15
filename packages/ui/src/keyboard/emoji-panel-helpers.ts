import type { EmojiCatalogGroup, EmojiCatalogItem } from "../emoji/emoji-catalog";

export function matchesEmojiItem(item: EmojiCatalogItem, query: string): boolean {
  const normalizedQuery = query.toLocaleLowerCase();
  return (
    !query ||
    item.text.includes(query) ||
    item.keywords.toLocaleLowerCase().includes(normalizedQuery)
  );
}

export function clipboardTooltip(text: string): string {
  const preview = text.replace(/[\r\t]/g, " ").replace(/\n+$/, "");
  const characters = Array.from(preview);
  return characters.length > 200 ? `${characters.slice(0, 200).join("")}…` : preview;
}

/** 组里与 `query` 匹配的项：组的 `keywords` 匹配时整组都算，否则逐项匹配。组的搜索词只用于匹配，不改写各项。 */
export function matchingGroupItems(group: EmojiCatalogGroup, query: string): EmojiCatalogItem[] {
  if (query && group.keywords?.toLocaleLowerCase().includes(query.toLocaleLowerCase())) {
    return group.items;
  }
  return group.items.filter((item) => matchesEmojiItem(item, query));
}

export function flattenGroups(groups: EmojiCatalogGroup[]): EmojiCatalogItem[] {
  return groups.flatMap((group) => group.items);
}

/** Prefers the first CJK keyword for a compact tooltip label, then the first token. */
export function emojiDisplayName(keywords: string | undefined, fallback = ""): string {
  const tokens = (keywords ?? "").split(/\s+/).filter(Boolean);
  if (!tokens.length) return fallback;
  const cjk = tokens.find((token) => /[\u3400-\u9fff\uf900-\ufaff]/.test(token));
  return cjk ?? tokens[0];
}

/** 目录里的英文标识保持不变，界面用中文名称；插件自定义名称原样显示。 */
export function symbolCategoryTitle(title: string): string {
  const titles: Record<string, string> = {
    "Stars and shapes": "特殊符号",
    "Arrows and lines": "箭头与线条",
    Punctuation: "标点符号",
    Math: "数学与序号",
    Currency: "货币与单位",
    Hearts: "爱心与表情",
    Letters: "字母与文字",
    Games: "游戏符号",
    Culture: "文化符号",
    "Animals and nature": "动物与自然",
    "People and activity": "人物与活动",
    More: "更多符号",
    Stars: "星形",
    Asterisks: "星号",
    Circles: "圆形",
    Triangles: "三角形",
    Squares: "方形",
    "Other shapes": "其他形状",
    "Bullet points": "项目符号",
    Arrows: "箭头",
    Lines: "线条",
    "Random lines": "制表线条",
    Brackets: "括号",
    "Quotation marks": "引号",
    Pilcrow: "段落标记",
    "Check marks": "勾选符号",
    "X marks": "叉号",
    Numbers: "数字序号",
    Fractions: "分数",
    Pi: "圆周率",
    "Super/subscripts": "上标与下标",
    Business: "商业符号",
    Units: "单位符号",
    Eyes: "眼睛",
    Monochrome: "单色表情",
    "Latin letters": "拉丁字母",
    "Latin extended": "扩展拉丁字母",
    "Greek letters": "希腊字母",
    "Japanese kana": "日文假名",
    Braille: "盲文",
    Korean: "韩文字符",
    "Card suits": "扑克牌",
    Chess: "国际象棋",
    Dice: "骰子",
    "Religion and culture": "宗教与文化",
    Crosses: "十字架",
    Zodiac: "星座",
    Gender: "性别",
    Totems: "图腾",
    Animals: "动物",
    Flowers: "花卉",
    Weather: "天气",
    Music: "音乐",
    Technical: "技术符号",
    Menu: "菜单符号",
    Miscellaneous: "杂项符号",
    "Block elements": "块状字符",
    Mashup: "组合符号",
  };
  return titles[title] ?? title;
}
