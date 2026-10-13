/** Small, host-neutral pieces of the Windows candidate presentation contract. */
export class CandidatePresentationPolicy {
  static badge(source: number): string {
    if (source === 2) return " ☁️";
    if (source === 3) return " 🤖";
    return "";
  }

  /** Engine 候选来源 12：AI 座位上的占位行（「…」等待中，「—」没有结果），画成次要色，不加标记（#6888）。 */
  static aiPlaceholder(source: number): boolean {
    return source === 12;
  }
}
