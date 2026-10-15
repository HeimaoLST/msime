// @vitest-environment jsdom
import { StrictMode, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BottomSheet } from "../../../../packages/ui/src/account/login-sheet";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开账号面板
      </button>
      <input aria-label="页面输入框" />
      <button type="button" onClick={() => setOpen(false)}>
        从页面关闭面板
      </button>
      {open && (
        <BottomSheet title="合成账号面板" onClose={() => setOpen(false)}>
          <input aria-label="合成昵称" data-sheet-autofocus />
        </BottomSheet>
      )}
    </>
  );
}

function openSheet(strict: boolean) {
  render(
    strict ? (
      <StrictMode>
        <Harness />
      </StrictMode>
    ) : (
      <Harness />
    ),
  );
  const opener = screen.getByRole("button", { name: "打开账号面板" });
  opener.focus();
  fireEvent.click(opener);
  const field = screen.getByRole("textbox", { name: "合成昵称" });
  expect(document.activeElement).toBe(field);
  return { opener, field };
}

test.each(
  [false, true].flatMap((strict) => ["关闭按钮", "Escape"].map((action) => ({ strict, action }))),
)("账号面板 $action 关闭后恢复开启按钮焦点（StrictMode=$strict）", ({ strict, action }) => {
  const { opener, field } = openSheet(strict);
  if (action === "关闭按钮") {
    const close = screen.getByRole("button", { name: "关闭" });
    close.focus();
    fireEvent.click(close);
  } else {
    fireEvent.keyDown(field, { key: "Escape" });
  }
  expect(screen.queryByRole("dialog", { name: "合成账号面板" })).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test.each([false, true])("账号面板保留已移到页面上的焦点（StrictMode=%s）", (strict) => {
  openSheet(strict);
  const outside = screen.getByRole("textbox", { name: "页面输入框" });
  outside.focus();
  fireEvent.click(screen.getByRole("button", { name: "从页面关闭面板" }));
  expect(screen.queryByRole("dialog", { name: "合成账号面板" })).toBeNull();
  expect(document.activeElement).toBe(outside);
});

test.each([false, true])("账号面板的 Tab 焦点留在面板内（StrictMode=%s）", (strict) => {
  const { field } = openSheet(strict);
  const close = screen.getByRole("button", { name: "关闭" });

  field.focus();
  expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(false);
  expect(document.activeElement).toBe(close);
  expect(fireEvent.keyDown(close, { key: "Tab", shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(field);
  expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "页面输入框" }));
});

test("账号面板内部 Tab 保留默认导航，边界跳过不可用控件", () => {
  render(
    <BottomSheet title="合成登录面板" onClose={() => undefined} closeDisabled>
      <input aria-label="合成邮箱" data-sheet-autofocus />
      <a href="#synthetic-privacy">合成隐私政策</a>
      <button type="button" disabled>
        禁用操作
      </button>
      <button type="button" tabIndex={-1}>
        仅程序聚焦
      </button>
      <button type="button" hidden>
        隐藏操作
      </button>
      <input type="hidden" />
    </BottomSheet>,
  );
  const field = screen.getByRole("textbox", { name: "合成邮箱" });
  const link = screen.getByRole("link", { name: "合成隐私政策" });
  expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(true);
  expect(fireEvent.keyDown(field, { key: "Tab", shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(link);
  expect(fireEvent.keyDown(link, { key: "Tab", shiftKey: true })).toBe(true);
  expect(fireEvent.keyDown(link, { key: "Tab" })).toBe(false);
  expect(document.activeElement).toBe(field);
});

test("账号面板所有控件禁用时 Tab 仍留在面板", () => {
  const view = render(
    <BottomSheet title="合成等待面板" onClose={() => undefined}>
      <input aria-label="合成等待字段" data-sheet-autofocus />
    </BottomSheet>,
  );
  const field = screen.getByRole("textbox", { name: "合成等待字段" });
  expect(document.activeElement).toBe(field);
  view.rerender(
    <BottomSheet title="合成等待面板" onClose={() => undefined} closeDisabled>
      <input aria-label="合成等待字段" disabled data-sheet-autofocus />
    </BottomSheet>,
  );
  expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(false);
  const dialog = screen.getByRole("dialog", { name: "合成等待面板" });
  expect(document.activeElement).toBe(dialog);
  expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(dialog);
});

test("初始没有可用控件的账号面板聚焦容器", () => {
  render(
    <BottomSheet title="合成初始等待面板" onClose={() => undefined} closeDisabled>
      <input aria-label="合成禁用字段" disabled />
    </BottomSheet>,
  );
  expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "合成初始等待面板" }));
});

test("移除已聚焦的表单控件时由账号面板接续焦点", () => {
  const view = render(
    <BottomSheet title="合成切换面板" onClose={() => undefined}>
      <input aria-label="合成旧字段" data-sheet-autofocus />
    </BottomSheet>,
  );
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "合成旧字段" }));
  view.rerender(
    <BottomSheet title="合成切换面板" onClose={() => undefined}>
      <button type="button">合成新操作</button>
    </BottomSheet>,
  );
  const dialog = screen.getByRole("dialog", { name: "合成切换面板" });
  expect(document.activeElement).toBe(dialog);
  expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(false);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "关闭" }));
});
