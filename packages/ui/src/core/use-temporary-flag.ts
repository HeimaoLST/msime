import { useCallback } from "react";
import { useTimedValue } from "./use-timed-value";

/** 每次展示都会重新计时的临时 UI 标记。 */
export function useTemporaryFlag(durationMs: number) {
  const [active, update] = useTimedValue(false);
  const show = useCallback(() => update(true, durationMs), [durationMs, update]);

  return [active, show] as const;
}
