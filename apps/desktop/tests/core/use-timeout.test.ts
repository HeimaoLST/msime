// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useTimeout } from "../../../../packages/ui/src/core/use-timeout";

afterEach(() => {
  vi.useRealTimers();
});

test("runs once after the delay and stops after unmount", () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  const { unmount } = renderHook(() => useTimeout(callback, 1000));

  act(() => vi.advanceTimersByTime(1000));
  expect(callback).toHaveBeenCalledOnce();

  unmount();
  act(() => vi.advanceTimersByTime(1000));
  expect(callback).toHaveBeenCalledOnce();
});

test("does not schedule when disabled", () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  renderHook(() => useTimeout(callback, null));

  act(() => vi.advanceTimersByTime(1000));
  expect(callback).not.toHaveBeenCalled();
});

const timeoutConsumers = import.meta.glob<string>(
  [
    "../../../../packages/ui/src/settings/handwriting-pad-preview.tsx",
    "../../../../packages/ui/src/account/macos-install-page.tsx",
  ],
  { eager: true, query: "?raw", import: "default" },
);

test.each(Object.entries(timeoutConsumers))("%s 复用公共延迟定时器生命周期", (_path, source) => {
  expect(source).toContain('from "../core/use-timeout"');
  expect(source).not.toContain("window.setTimeout");
  expect(source).not.toContain("window.clearTimeout");
});
