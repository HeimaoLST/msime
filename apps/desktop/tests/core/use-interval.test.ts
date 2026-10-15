// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import * as intervals from "../../../../packages/ui/src/core/use-interval";
import { useInterval } from "../../../../packages/ui/src/core/use-interval";

afterEach(() => {
  vi.useRealTimers();
});

test("runs at the interval and stops after unmount", () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  const { unmount } = renderHook(() => useInterval(callback, 1000));

  act(() => vi.advanceTimersByTime(2500));
  expect(callback).toHaveBeenCalledTimes(2);

  unmount();
  act(() => vi.advanceTimersByTime(2000));
  expect(callback).toHaveBeenCalledTimes(2);
});

test("uses the latest callback without restarting the interval", () => {
  vi.useFakeTimers();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = renderHook(({ callback }) => useInterval(callback, 1000), {
    initialProps: { callback: first },
  });

  rerender({ callback: second });
  act(() => vi.advanceTimersByTime(1000));

  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();
});

test("does not schedule when disabled", () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  renderHook(() => useInterval(callback, null));

  act(() => vi.advanceTimersByTime(3000));
  expect(callback).not.toHaveBeenCalled();
});

const macosIntervalConsumers = import.meta.glob<string>(
  [
    "../../../../packages/ui/src/settings/use-macos-settings.ts",
    "../../../../packages/ui/src/account/macos-install-page.tsx",
  ],
  { eager: true, query: "?raw", import: "default" },
);

test.each(Object.entries(macosIntervalConsumers))(
  "%s 复用公共间隔定时器生命周期",
  (_path, source) => {
    expect(source).toContain('from "../core/use-interval"');
    expect(source).not.toContain("window.setInterval");
    expect(source).not.toContain("window.clearInterval");
  },
);

test("同步间隔订阅只在约定时间触发，清理后停止", () => {
  expect(intervals.subscribeToInterval).toBeTypeOf("function");
  vi.useFakeTimers();
  const callback = vi.fn();
  const stop = intervals.subscribeToInterval(callback, 400);
  expect(callback).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(399));
  expect(callback).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(callback).toHaveBeenCalledOnce();
  stop();
  stop();
  act(() => vi.advanceTimersByTime(800));
  expect(callback).toHaveBeenCalledOnce();
});
