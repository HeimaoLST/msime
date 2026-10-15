/**
 * 中文标点下符号键画的键面，即 Engine 按标点契约（`shared/contracts/punctuation/policy.json`）为这个 ASCII 键写出的字。键仍然发送 ASCII，由 Engine 决定写什么（包括引号交替和书名号嵌套），这里只决定键上画什么。
 *
 * 引号与方头括号有两组字（偏好 `quote_style`、`bracket_style`），用哪一组看 View 的 `punctuation_marks`：直角引号下 `'` 画「、`"` 画『，空心括号下 `[` `]` 画〖〗。
 */
const FACES: Map<string, string> = new Map<string, string>([
  [",", "，"],
  [".", "。"],
  ["?", "？"],
  ["!", "！"],
  [";", "；"],
  [":", "："],
  ["'", "‘"],
  ['"', "“"],
  ["\\", "、"],
  ["(", "（"],
  [")", "）"],
  ["[", "【"],
  ["]", "】"],
  ["<", "《"],
  [">", "》"],
]);

/** View 的 `punctuation_marks`；没有这个字段的旧宿主库按缺省处理。 */
export interface PunctuationMarksView {
  quotes?: string;
  brackets?: string;
}

export class ChineseSymbolFaces {
  /** `symbol` 在中文标点下的键面；没有中文键面时为 undefined。 */
  static face(symbol: string, cornerQuotes: boolean, hollowBrackets: boolean): string | undefined {
    if (cornerQuotes && symbol === "'") return "「";
    if (cornerQuotes && symbol === '"') return "『";
    if (hollowBrackets && symbol === "[") return "〖";
    if (hollowBrackets && symbol === "]") return "〗";
    return FACES.get(symbol);
  }

  /** View 报告的是直角引号。 */
  static cornerQuotes(marks: PunctuationMarksView | undefined): boolean {
    return marks !== undefined && marks.quotes === "corner";
  }

  /** View 报告的是空心方头括号。 */
  static hollowBrackets(marks: PunctuationMarksView | undefined): boolean {
    return marks !== undefined && marks.brackets === "hollow";
  }
}
