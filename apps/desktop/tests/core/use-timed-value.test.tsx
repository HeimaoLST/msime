// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useTimedValue } from "../../../../packages/ui/src/core/use-timed-value";

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("重复值和替换值都从最后一次更新重新计时", () => {
  const { result } = renderHook(() => useTimedValue(""));
  act(() => result.current[1]("合成提示", 1600));
  act(() => vi.advanceTimersByTime(1000));
  act(() => result.current[1]("合成提示", 1600));
  act(() => vi.advanceTimersByTime(600));
  expect(result.current[0]).toBe("合成提示");
  act(() => result.current[1]("替换提示", 1600));
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current[0]).toBe("替换提示");
  act(() => vi.advanceTimersByTime(600));
  expect(result.current[0]).toBe("");
});

test("常驻值和显式清空都取消先前的计时器", () => {
  const { result } = renderHook(() => useTimedValue(""));
  act(() => result.current[1]("临时提示", 1600));
  act(() => result.current[1]("合成错误"));
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current[0]).toBe("合成错误");
  expect(vi.getTimerCount()).toBe(0);

  act(() => result.current[1]("另一提示", 1600));
  act(() => result.current[1](""));
  expect(result.current[0]).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});

test("StrictMode 下卸载会清理计时器并忽略迟到更新", () => {
  const { result, unmount } = renderHook(() => useTimedValue(false), {
    wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
  });
  act(() => result.current[1](true, 1800));
  expect(result.current[0]).toBe(true);
  const update = result.current[1];
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  act(() => update(true, 1800));
  expect(vi.getTimerCount()).toBe(0);
});
