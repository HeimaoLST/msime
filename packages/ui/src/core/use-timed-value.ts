import { useCallback, useEffect, useRef, useState } from "react";

/** 更新值时取消旧计时器；指定时长后恢复空值，省略时长则保持新值。 */
export function useTimedValue<T>(emptyValue: T) {
  const [state, setState] = useState<{ value: T; expiresAt?: number }>(() => ({
    value: emptyValue,
  }));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = useCallback((next: T, durationMs?: number) => {
    clearTimeout(timer.current);
    setState({
      value: next,
      expiresAt: durationMs === undefined ? undefined : Date.now() + durationMs,
    });
  }, []);

  useEffect(() => {
    if (state.expiresAt === undefined) return;
    // 提交后才创建计时器，卸载后的迟到更新不会启动它；重放 effect 仍沿用原来的到期时间。
    const pending = setTimeout(
      () => setState({ value: emptyValue }),
      Math.max(0, state.expiresAt - Date.now()),
    );
    timer.current = pending;
    return () => clearTimeout(pending);
  }, [emptyValue, state]);

  return [state.value, update] as const;
}
