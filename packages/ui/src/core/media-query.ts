/** 注册媒体查询变化监听，并兼容没有 EventTarget 监听方法的旧宿主。 */
export function subscribeMediaQuery(media: MediaQueryList, listener: () => void): () => void {
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  media.addListener(listener);
  return () => media.removeListener(listener);
}
