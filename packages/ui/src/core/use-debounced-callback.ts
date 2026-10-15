import { useCallback, useEffect, useRef } from "react";
import { useLatestRef } from "./use-latest-ref";

export interface DebouncedCallback<T extends unknown[]> {
  schedule: (...args: T) => void;
  cancel: () => void;
}

/** 延迟执行最后一次调用；新调用会取消旧计时器，组件卸载或延迟变化时也会清理。 */
export function useDebouncedCallback<T extends unknown[]>(
  callback: (...args: T) => void,
  delayMs: number,
): DebouncedCallback<T> {
  const callbackRef = useLatestRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const schedule = useCallback(
    (...args: T) => {
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        callbackRef.current(...args);
      }, delayMs);
    },
    [callbackRef, cancel, delayMs],
  );
  useEffect(() => cancel, [cancel, delayMs]);
  return { schedule, cancel };
}
