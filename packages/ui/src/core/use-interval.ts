import { useEffect } from "react";
import { useLatestRef } from "./use-latest-ref";

/** 启动间隔回调，并返回可重复调用的清理函数。 */
export function subscribeToInterval(callback: () => void, delayMs: number): () => void {
  const timer = window.setInterval(callback, delayMs);
  return () => window.clearInterval(timer);
}

/** 按间隔运行回调；间隔为空时停用，并在组件卸载或间隔变化时清理定时器。 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const callbackRef = useLatestRef(callback);
  useEffect(() => {
    if (delayMs === null) return;
    return subscribeToInterval(() => callbackRef.current(), delayMs);
  }, [delayMs]);
}
