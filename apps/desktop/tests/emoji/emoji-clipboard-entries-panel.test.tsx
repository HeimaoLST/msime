// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmojiPanel } from "@msime/ui";

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  // jsdom 不实现滚动；这里保留真实 DOM 焦点，只替代滚动调用。
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  if (scrollDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

test("真实面板保留原文复制和键盘删除，删除后焦点落到邻行及搜索框", async () => {
  const raw = "合成\n第一条";
  let items = [raw, "合成第二条"];
  const copy = vi.fn().mockResolvedValue(undefined);
  const copyText = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn(async (text: string) => {
    items = items.filter((item) => item !== text);
  });
  const view = render(
    <EmojiPanel
      initialPage="clipboard"
      client={{
        close: vi.fn().mockResolvedValue(undefined),
        copyText,
        loadCatalog: async () => ({ emoji: [], kaomoji: [], symbols: [] }),
        clipboard: { list: async () => items, copy, remove, onChanged: async () => () => {} },
      }}
    />,
  );
  const first = await screen.findByRole("button", { name: "合成 第一条" });
  first.focus();
  fireEvent.keyDown(first, { key: "c", ctrlKey: true });
  await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith(raw));
  expect(copyText).not.toHaveBeenCalled();
  fireEvent.keyDown(first, { key: "Delete" });
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith(raw));
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "合成第二条" })),
  );
  expect(view.container.querySelectorAll("[data-clipboard-row]")).toHaveLength(1);
  fireEvent.keyDown(document.activeElement!, { key: "Delete" });
  await waitFor(() => expect(remove).toHaveBeenLastCalledWith("合成第二条"));
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "搜索" })),
  );
  expect(screen.getByText("暂无剪贴板记录")).toBeDefined();
});

test("面板搜索框与记录导航仍在同一根节点，方向键和查找快捷键可达", async () => {
  render(
    <EmojiPanel
      initialPage="clipboard"
      client={{
        close: vi.fn().mockResolvedValue(undefined),
        loadCatalog: async () => ({ emoji: [], kaomoji: [], symbols: [] }),
        clipboard: {
          list: async () => ["合成第一条", "合成第二条"],
          onChanged: async () => () => {},
        },
      }}
    />,
  );
  const first = await screen.findByRole("button", { name: "合成第一条" });
  const second = screen.getByRole("button", { name: "合成第二条" });
  const search = screen.getByRole("textbox", { name: "搜索" });
  search.focus();
  fireEvent.keyDown(search, { key: "ArrowDown" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "f", ctrlKey: true });
  expect(document.activeElement).toBe(search);
});
