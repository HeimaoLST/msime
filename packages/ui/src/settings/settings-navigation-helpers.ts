/** 触屏设置宿主共用的四个底部标签页：设置、对话、统计、我的。第二格原来是「社区」，社区内容并进了皮肤、词库、AI 辅助这些功能页（完整图库从那些页面打开，见 `useCommunityGallerySubview`），这一格换成 AI 对话，打开的就是原来「AI 辅助」里那一行进入的 `chat` 页。宿主不提供对话客户端时没有这一页，标签栏也就没有这一格。 */
export type MobilePrimaryPageId = "home" | "chat" | "typing-statistics" | "account";

export const mobilePrimaryPageIds: readonly MobilePrimaryPageId[] = [
  "home",
  "chat",
  "typing-statistics",
  "account",
];

/** 触屏宿主从「我的」而非「设置」标签页列表打开的页面（有「我的」标签页时 `settingsPageProjections` 不把它们列入该列表），因此它们留在「我的」的导航栈上：该标签保持高亮，切到别的标签再回来仍回到这些页面。 */
const accountTabPages: readonly string[] = [
  "about",
  "feedback",
  "help",
  "usage-reporting",
  "privacy",
];

/** 让嵌套的设置页留在打开它们的标签页的导航栈上：「我的」自己的子页面留在「我的」，其他页面都留在「设置」。 */
export function mobileTabForPage(page: string): MobilePrimaryPageId {
  if (mobilePrimaryPageIds.includes(page as MobilePrimaryPageId)) {
    return page as MobilePrimaryPageId;
  }
  return accountTabPages.includes(page) ? "account" : "home";
}

/** Resolves a host route to one of `pages`, or to the shell's fallback page for an id that is not among them. */
export function requestedPage<PageId extends string>(
  value: string | undefined,
  pages: readonly { id: PageId }[],
  fallback: PageId,
): PageId {
  return pages.some((page) => page.id === value) ? (value as PageId) : fallback;
}
