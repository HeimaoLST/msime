// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { EmojiClipboardEntries } from "@msime/ui";

afterEach(cleanup);

const raw = "合成\r\t记录\n下一行\n\n";
const items: readonly string[] = Object.freeze([raw, "合成第二条"]);

function actions() {
  return { onCopy: vi.fn(), onItemKeyDown: vi.fn(), onPaste: vi.fn(), onRemove: vi.fn() };
}

test("列表保留顺序和导航标记，预览折叠控制字符，动作传原文", () => {
  const callbacks = actions();
  const view = render(<EmojiClipboardEntries items={items} busy={false} canCopy {...callbacks} />);
  const rows = view.container.querySelectorAll<HTMLElement>("[data-clipboard-row]");
  expect(rows).toHaveLength(2);
  expect(rows[0].parentElement).toBe(view.container.firstElementChild);
  const entry = rows[0].querySelector<HTMLButtonElement>("[data-clipboard-item]")!;
  expect(entry.parentElement).toBe(rows[0]);
  expect(entry.hasAttribute("data-emoji-navigation-item")).toBe(true);
  expect(entry.textContent).toBe("合成  记录 下一行  ");
  expect(entry.title).toBe("合成  记录\n下一行");
  expect(rows[1].querySelector("[data-clipboard-item]")?.textContent).toBe(items[1]);
  expect(
    within(rows[0])
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["合成  记录 下一行  ", "粘贴", "删除"]);
  fireEvent.click(entry);
  fireEvent.click(within(rows[0]).getByRole("button", { name: "粘贴此条记录到原应用" }));
  fireEvent.click(within(rows[0]).getByRole("button", { name: "删除此条记录" }));
  expect(callbacks.onCopy.mock.calls).toEqual([[raw]]);
  expect(callbacks.onPaste.mock.calls).toEqual([[raw]]);
  expect(callbacks.onRemove.mock.calls).toEqual([[raw]]);
});

test("长 tooltip 按 Unicode 字符截断，复制保留完整原文", () => {
  const text = "😀".repeat(201) + "\n\n";
  const callbacks = actions();
  render(<EmojiClipboardEntries items={[text]} busy={false} canCopy {...callbacks} />);
  const entry = screen.getAllByRole("button")[0];
  expect(entry.title).toBe("😀".repeat(200) + "…");
  fireEvent.click(entry);
  expect(callbacks.onCopy.mock.calls).toEqual([[text]]);
});

test.each([
  [false, false, null],
  [true, false, "Control+c"],
  [false, true, "Delete"],
  [true, true, "Control+c Delete"],
] as const)("复制能力 %s、删除能力 %s 保持对应快捷键声明", (canCopy, removable, shortcuts) => {
  const callbacks = actions();
  render(
    <EmojiClipboardEntries
      items={[raw]}
      busy={false}
      canCopy={canCopy}
      onCopy={callbacks.onCopy}
      onItemKeyDown={callbacks.onItemKeyDown}
      onRemove={removable ? callbacks.onRemove : undefined}
    />,
  );
  const entry = screen.getAllByRole("button")[0];
  expect(entry.getAttribute("aria-keyshortcuts")).toBe(shortcuts);
  expect(screen.queryByRole("button", { name: "删除此条记录" }) !== null).toBe(removable);
  expect(screen.queryByRole("button", { name: "粘贴此条记录到原应用" })).toBeNull();
  fireEvent.click(entry);
  expect(callbacks.onCopy.mock.calls).toEqual([[raw]]);
});

test("键盘事件原样交给调用方，不在视图里执行复制或删除", () => {
  const callbacks = actions();
  const onItemKeyDown = vi.fn((event: KeyboardEvent<HTMLButtonElement>, text: string) => {
    expect(event.currentTarget).toBe(screen.getAllByRole("button")[0]);
    expect(text).toBe(raw);
    event.preventDefault();
  });
  render(
    <EmojiClipboardEntries
      items={[raw]}
      busy={false}
      canCopy
      {...callbacks}
      onItemKeyDown={onItemKeyDown}
    />,
  );
  const entry = screen.getAllByRole("button")[0];
  expect(fireEvent.keyDown(entry, { key: "C", ctrlKey: true })).toBe(false);
  expect(onItemKeyDown).toHaveBeenCalledOnce();
  expect(onItemKeyDown.mock.calls[0][0].key).toBe("C");
  expect(onItemKeyDown.mock.calls[0][0].ctrlKey).toBe(true);
  expect(callbacks.onCopy).not.toHaveBeenCalled();
  expect(callbacks.onRemove).not.toHaveBeenCalled();
});

test("忙时禁用全部按钮，恢复后可操作，并响应可选能力变化", () => {
  const callbacks = actions();
  const view = render(<EmojiClipboardEntries items={[raw]} busy canCopy {...callbacks} />);
  for (const button of screen.getAllByRole("button")) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(callbacks.onCopy).not.toHaveBeenCalled();
  expect(callbacks.onPaste).not.toHaveBeenCalled();
  expect(callbacks.onRemove).not.toHaveBeenCalled();
  view.rerender(
    <EmojiClipboardEntries
      items={[raw]}
      busy={false}
      canCopy
      onCopy={callbacks.onCopy}
      onItemKeyDown={callbacks.onItemKeyDown}
    />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button"));
  expect(callbacks.onCopy.mock.calls).toEqual([[raw]]);
});

test("空列表仅呈现原列表容器，状态文案由面板提供", () => {
  const callbacks = actions();
  const view = render(<EmojiClipboardEntries items={[]} busy={false} canCopy {...callbacks} />);
  expect(view.container.childElementCount).toBe(1);
  expect(view.container.firstElementChild?.childElementCount).toBe(0);
});
