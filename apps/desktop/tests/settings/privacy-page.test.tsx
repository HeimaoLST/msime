// @vitest-environment jsdom
import { testHost } from "../support/host";
import { saveSettingsNow, settingsFormReady } from "../support/settings-form";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SettingsPage, type Snapshot } from "@msime/ui";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "");
});

const initial: Snapshot = {
  format_version: 1,
  revision: 1,
  preferences: {
    scheme: "quanpin",
    shuangpin_profile: "xiaohe",
    global_theme: "system",
    candidate_page_size: 5,
    learning: true,
    chinese_punctuation: true,
  },
};

// 「我的 › 隐私」打开应用里的页面：先用几句话说数据怎么处理，再是匿名使用统计的开关，完整隐私政策的网页在最后一行，点了才去浏览器。
test("the phone privacy page explains the data in the app and links the policy last", async () => {
  const save = vi.fn().mockImplementation(async (_revision: number, next: unknown) => ({
    ...initial,
    revision: 2,
    preferences: next,
  }));
  const openExternalUrl = vi.fn().mockResolvedValue(undefined);
  render(
    <SettingsPage
      initialPage="privacy"
      client={{
        load: async () => initial,
        save,
        openExternalUrl,
        host: testHost({ platform: "harmony", mobile_settings: true, panel_windows: false }),
      }}
    />,
  );
  await settingsFormReady();
  const page = screen.getByRole("group", { name: "隐私" });
  const titles = [...page.querySelectorAll("[data-group-title]")].map((node) => node.textContent);
  expect(titles).toEqual(["你的数据", "匿名使用统计"]);
  expect(within(page).getByText("打的字留在手机上")).toBeTruthy();
  expect(openExternalUrl).not.toHaveBeenCalled();

  fireEvent.click(within(page).getByRole("switch", { name: "匿名使用统计" }));
  saveSettingsNow();
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls.at(-1)?.[1].usage_reporting).toBe(false);

  fireEvent.click(within(page).getByRole("button", { name: "完整隐私政策" }));
  expect(openExternalUrl).toHaveBeenCalledWith("https://msime.app/privacy/");
});

// 桌面的隐私设置在「关于」里，没有这一页。
test("desktop hosts have no separate privacy page", async () => {
  render(
    <SettingsPage
      initialPage="privacy"
      client={{ load: async () => initial, save: vi.fn(), host: testHost({ platform: "windows" }) }}
    />,
  );
  await settingsFormReady();
  expect(screen.queryByRole("group", { name: "隐私" })).toBeNull();
});
