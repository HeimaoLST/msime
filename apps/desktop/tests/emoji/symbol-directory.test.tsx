// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EmojiPanel } from "@msime/ui";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function fixture(sendText = vi.fn().mockResolvedValue(undefined)) {
  return {
    close: async () => {},
    sendText,
    copyText: vi.fn().mockResolvedValue(undefined),
    loadCatalog: async () => ({
      emoji: [],
      kaomoji: [],
      symbols: [
        {
          title: "Stars",
          parent: "Stars and shapes",
          icon: "★",
          items: [{ text: "★", keywords: "星形" }],
        },
        {
          title: "Numbers",
          parent: "Math",
          icon: "①",
          items: Array.from({ length: 70 }, (_, index) => ({
            text: `①${index}`,
            keywords: `序号${index}`,
          })),
        },
      ],
    }),
  };
}

async function open(client = fixture()) {
  render(<EmojiPanel client={client} />);
  fireEvent.click(screen.getByRole("button", { name: "符号" }));
  await screen.findByRole("button", { name: "数学与序号" });
  return client;
}

test("符号大全显示中文侧栏，分类切换清空搜索且完整展示长分类", async () => {
  await open();
  const categories = screen.getByRole("navigation", { name: "符号子分类" });
  expect(within(categories).getByRole("button", { name: "特殊符号" })).toBeDefined();
  fireEvent.change(screen.getByRole("textbox", { name: "搜索" }), { target: { value: "数学" } });
  expect(screen.queryByRole("button", { name: "★" })).toBeNull();
  expect(screen.getByRole("button", { name: "①69" })).toBeDefined();
  fireEvent.click(within(categories).getByRole("button", { name: "特殊符号" }));
  expect((screen.getByRole("textbox", { name: "搜索" }) as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "★" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "①69" })).toBeNull();
});

test("点击默认输入，成功后记录并恢复最近符号，复制仍可选择", async () => {
  const client = await open();
  const directory = screen.getByRole("region", { name: "符号目录" });
  fireEvent.click(within(directory).getByRole("button", { name: "★" }));
  await waitFor(() => expect(client.sendText).toHaveBeenCalledWith("★"));
  await waitFor(() =>
    expect(
      within(screen.getByRole("region", { name: "最近使用的符号" })).getByRole("button", {
        name: "★",
      }),
    ).toBeDefined(),
  );
  expect(client.copyText).not.toHaveBeenCalled();
  cleanup();
  await open(client);
  expect(
    within(screen.getByRole("region", { name: "最近使用的符号" })).getByRole("button", {
      name: "★",
    }),
  ).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /^复制$/ }));
  fireEvent.click(
    within(screen.getByRole("region", { name: "符号目录" })).getByRole("button", { name: "★" }),
  );
  await waitFor(() => expect(client.copyText).toHaveBeenCalledWith("★"));
  fireEvent.click(screen.getByRole("button", { name: "清除符号记录" }));
  expect(localStorage.getItem("msime.symbols.recent")).toBe("[]");
});

test("输入被拒绝时不写最近使用", async () => {
  await open(fixture(vi.fn().mockRejectedValue(new Error("synthetic rejection"))));
  fireEvent.click(
    within(screen.getByRole("region", { name: "符号目录" })).getByRole("button", { name: "★" }),
  );
  await screen.findByText("输入失败，可切换复制后手动粘贴");
  expect(localStorage.getItem("msime.symbols.recent")).toBe("[]");
});

test("符号搜索支持 Ctrl+F 和下方向键进入网格", async () => {
  await open();
  const search = screen.getByRole("textbox", { name: "搜索" });
  const first = within(screen.getByRole("region", { name: "符号目录" })).getByRole("button", {
    name: "★",
  });
  search.scrollIntoView = vi.fn();
  first.scrollIntoView = vi.fn();
  first.focus();
  fireEvent.keyDown(first, { key: "f", ctrlKey: true });
  expect(document.activeElement).toBe(search);
  fireEvent.keyDown(search, { key: "ArrowDown" });
  expect(document.activeElement).toBe(first);
});
