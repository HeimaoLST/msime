export type WindowFocusListener = () => void;

const noop = () => {};

/** 订阅文档可见性变化；显示或隐藏的处理规则由调用方决定。 */
export function subscribeToDocumentVisibilityChange(listener: () => void): () => void {
  if (typeof document === "undefined") return noop;
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

/** 订阅窗口事件并返回对称清理函数；没有窗口时返回空清理函数。 */
export function subscribeToWindowEvent<K extends keyof WindowEventMap>(
  event: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;
export function subscribeToWindowEvent(
  event: string,
  listener: (event: Event) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;
export function subscribeToWindowEvent(
  event: string,
  listener: (event: Event) => void,
  options?: boolean | AddEventListenerOptions,
): () => void {
  if (typeof window === "undefined") return noop;
  window.addEventListener(event, listener as EventListener, options);
  return () => window.removeEventListener(event, listener as EventListener, options);
}

/** 订阅窗口获得焦点事件，并返回对称的清理函数。 */
export function subscribeToWindowFocus(listener: WindowFocusListener): () => void {
  return subscribeToWindowEvent("focus", listener);
}

/** 订阅窗口失去焦点事件，并返回对称的清理函数。 */
export function subscribeToWindowBlur(listener: WindowFocusListener): () => void {
  return subscribeToWindowEvent("blur", listener);
}

/** 订阅窗口重新获得焦点或从后台回到前台的事件，并返回清理函数。 */
export function subscribeToWindowResume(listener: WindowFocusListener): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return noop;
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") listener();
  };
  const stopFocus = subscribeToWindowFocus(listener);
  const stopVisibility = subscribeToDocumentVisibilityChange(onVisibilityChange);
  return () => {
    stopFocus();
    stopVisibility();
  };
}
