// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StrictMode, useEffect, useLayoutEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, toastMillis, useToast } from "../../../../packages/ui/src/core/toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function CopyButton({ text = "已复制下载链接" }: { text?: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(text)}>
      复制 {text}
    </button>
  );
}

test("a toast is announced politely and leaves after 1.6 seconds", () => {
  render(
    <ToastProvider>
      <CopyButton />
    </ToastProvider>,
  );
  const region = screen.getByRole("status");
  expect(region.getAttribute("aria-live")).toBe("polite");
  expect(region.textContent).toBe("");

  fireEvent.click(screen.getByRole("button"));
  expect(region.textContent).toBe("已复制下载链接");

  act(() => vi.advanceTimersByTime(toastMillis - 1));
  expect(region.textContent).toBe("已复制下载链接");
  act(() => vi.advanceTimersByTime(1));
  expect(region.textContent).toBe("");
});

test("a new toast replaces the one showing and restarts the clock", () => {
  render(
    <ToastProvider>
      <CopyButton text="已复制" />
      <CopyButton text="已保存" />
    </ToastProvider>,
  );
  const region = screen.getByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "复制 已复制" }));
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole("button", { name: "复制 已保存" }));
  expect(region.textContent).toBe("已保存");

  act(() => vi.advanceTimersByTime(1000));
  expect(region.textContent).toBe("已保存");
  act(() => vi.advanceTimersByTime(toastMillis - 1000));
  expect(region.textContent).toBe("");
});

test("outside a provider showing a toast does nothing", () => {
  render(<CopyButton />);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText("已复制下载链接", { selector: "span" })).toBeNull();
});

test("相同 toast 重新挂载动画，卸载后迟到提示不创建计时器", () => {
  let show!: (text: string) => void;
  function CaptureToast() {
    show = useToast();
    return <CopyButton text="合成提示" />;
  }
  const { unmount } = render(
    <ToastProvider>
      <CaptureToast />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  const first = screen.getByRole("status").firstElementChild;
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("status").firstElementChild).not.toBe(first);
  act(() => vi.advanceTimersByTime(600));
  expect(screen.getByRole("status").textContent).toBe("合成提示");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  act(() => show("迟到提示"));
  expect(vi.getTimerCount()).toBe(0);
});

test.each([useEffect, useLayoutEffect])(
  "StrictMode 子组件挂载时显示的 toast 仍会到期消失：%s",
  (effect) => {
    function MountToast() {
      const show = useToast();
      effect(() => show("挂载提示"), [show]);
      return null;
    }
    render(
      <StrictMode>
        <ToastProvider>
          <MountToast />
        </ToastProvider>
      </StrictMode>,
    );
    expect(screen.getByRole("status").textContent).toBe("挂载提示");
    act(() => vi.advanceTimersByTime(toastMillis));
    expect(screen.getByRole("status").textContent).toBe("");
  },
);
