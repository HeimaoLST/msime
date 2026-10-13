// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  CLOUD_CLIPBOARD_PENDING,
  ClipboardHistorySection,
  CloudClipboardPanel,
  type CloudClipboardAction,
} from "@msime/ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const OWN_CODE = "0421 9873 5530 1176";
const OTHER_CODE = "1111 2222 3333 4444";
const OWN_ID = "a".repeat(32);
const OTHER_ID = "b".repeat(32);

function page(status: "ready" | "pending" | "disabled", extra: Record<string, unknown> = {}) {
  return {
    enabled: status !== "disabled",
    retention_days: 0,
    items: [],
    e2e: { status, code: OWN_CODE, pending_devices: 0, undecryptable: 0, ...extra },
  };
}

function device(id: string, name: string, approved: boolean, current: boolean, code: string) {
  return { device_id: id, name, created_at: "2026-10-11T08:00:00Z", approved, current, code };
}

function deviceStatus(other: ReturnType<typeof device>) {
  return {
    enabled: true,
    status: "ready",
    device_id: OWN_ID,
    code: OWN_CODE,
    devices: [device(OWN_ID, "合成电脑", true, true, OWN_CODE), other],
  };
}

/** 一个按动作作答的合成宿主；`answers` 里没有的动作返回空对象。 */
function host(answers: Partial<Record<CloudClipboardAction["operation"], () => unknown>>) {
  return vi.fn(async (action: CloudClipboardAction) => {
    const answer = answers[action.operation];
    return (answer ? answer() : {}) as Record<string, unknown>;
  });
}

test("a pending device shows its own code, where to approve it and no upload box", async () => {
  const request = host({ list: () => page("pending") });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);

  const notice = await screen.findByRole("region", { name: "本设备等待允许" });
  expect(within(notice).getByLabelText("本设备核对码").textContent).toBe(OWN_CODE);
  expect(notice.textContent).toContain("已在使用云剪贴板的设备上打开「云剪贴板」");
  expect(notice.textContent).toContain("点「允许」");
  expect(screen.queryByRole("textbox", { name: "待上传文本" })).toBeNull();
  expect(screen.queryByRole("button", { name: "上传明确选择的文本" })).toBeNull();

  fireEvent.click(within(notice).getByRole("button", { name: "刷新" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request).toHaveBeenLastCalledWith({ operation: "list", search: "" });
});

test("resetting from a pending device is confirmed and says other devices need approval again", async () => {
  let current = page("pending");
  const request = host({
    list: () => current,
    reset: () => {
      current = page("ready");
      return { ...deviceStatus(device(OTHER_ID, "合成手机", false, false, OTHER_CODE)) };
    },
  });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);
  const notice = await screen.findByRole("region", { name: "本设备等待允许" });

  fireEvent.click(within(notice).getByRole("button", { name: "重置云剪贴板" }));
  const dialog = screen.getByRole("alertdialog", { name: "重置云剪贴板" });
  expect(dialog.textContent).toContain("云端的全部条目会被清空");
  expect(dialog.textContent).toContain("其他所有设备都需要在本设备上重新允许");
  expect(request).not.toHaveBeenCalledWith({ operation: "reset" });

  fireEvent.click(within(dialog).getByRole("button", { name: "确认重置" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith({ operation: "reset" }));
  expect(await screen.findByRole("textbox", { name: "待上传文本" })).toBeDefined();
  expect(await screen.findByText("云剪贴板已重置，其他设备需要重新允许")).toBeDefined();
});

test("devices waiting for approval are listed with their codes and can be approved or rejected", async () => {
  let waiting = true;
  const request = host({
    list: () => page("ready", { pending_devices: waiting ? 1 : 0 }),
    devices: () => deviceStatus(device(OTHER_ID, "合成手机", false, false, OTHER_CODE)),
    approve: () => {
      waiting = false;
      return deviceStatus(device(OTHER_ID, "合成手机", true, false, OTHER_CODE));
    },
    reject: () => ({ ...deviceStatus(device(OTHER_ID, "合成手机", true, false, OTHER_CODE)) }),
  });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);

  const prompt = await screen.findByRole("region", { name: "等待允许的设备" });
  expect(prompt.textContent).toContain("核对两台设备上的核对码一致再允许");
  await within(prompt).findByText("合成手机");
  expect(within(prompt).getByLabelText("合成手机 的核对码").textContent).toBe(OTHER_CODE);

  fireEvent.click(within(prompt).getByRole("button", { name: "允许 合成手机" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({ operation: "approve", device_id: OTHER_ID }),
  );
  expect(await screen.findByText("已允许「合成手机」使用云剪贴板")).toBeDefined();
  await waitFor(() => expect(screen.queryByRole("region", { name: "等待允许的设备" })).toBeNull());
});

test("rejecting a waiting device deletes only its registration", async () => {
  const request = host({
    list: () => page("ready", { pending_devices: 1 }),
    devices: () => deviceStatus(device(OTHER_ID, "合成手机", false, false, OTHER_CODE)),
    reject: () => ({ ...deviceStatus(device(OTHER_ID, "合成手机", true, false, OTHER_CODE)) }),
  });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);
  const prompt = await screen.findByRole("region", { name: "等待允许的设备" });
  fireEvent.click(await within(prompt).findByRole("button", { name: "拒绝 合成手机" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({ operation: "reject", device_id: OTHER_ID }),
  );
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ operation: "remove" }));
});

test("removing an approved device is confirmed and warns that other devices need approval again", async () => {
  const alone = {
    enabled: true,
    status: "ready",
    device_id: OWN_ID,
    code: OWN_CODE,
    devices: [device(OWN_ID, "合成电脑", true, true, OWN_CODE)],
  };
  let removed = false;
  const request = host({
    list: () => page("ready"),
    devices: () =>
      removed ? alone : deviceStatus(device(OTHER_ID, "合成平板", true, false, OTHER_CODE)),
    remove: () => {
      removed = true;
      return alone;
    },
  });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);
  fireEvent.click(await screen.findByRole("button", { name: "管理设备" }));
  const list = await screen.findByRole("region", { name: "云剪贴板设备" });
  expect(within(list).getByText("合成电脑（本机）")).toBeDefined();
  expect(within(list).queryByRole("button", { name: "移除 合成电脑" })).toBeNull();

  fireEvent.click(within(list).getByRole("button", { name: "移除 合成平板" }));
  const dialog = screen.getByRole("alertdialog", { name: "移除设备" });
  expect(dialog.textContent).toContain("其他所有设备（包括仍在使用的）都需要在本设备上重新允许");
  fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ operation: "remove" }));

  fireEvent.click(within(list).getByRole("button", { name: "移除 合成平板" }));
  fireEvent.click(screen.getByRole("button", { name: "确认移除" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({ operation: "remove", device_id: OTHER_ID }),
  );
  expect(await screen.findByText("已移除设备，其他设备需要重新允许")).toBeDefined();
  await waitFor(() =>
    expect(
      within(screen.getByRole("region", { name: "云剪贴板设备" })).queryByText("合成平板"),
    ).toBeNull(),
  );
});

test("entries this device cannot decrypt are reported instead of shown", async () => {
  const request = host({
    list: () => ({
      ...page("ready", { undecryptable: 2 }),
      items: [
        { id: "c".repeat(64), text: "合成云端内容", updated_at: "", pinned: false, device: "" },
      ],
    }),
  });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);
  expect(await screen.findByText("合成云端内容")).toBeDefined();
  expect(screen.getByRole("note").textContent).toContain("有 2 条云端记录无法在本设备解密");
});

test("an upload refused because this device is pending explains how to get approved", async () => {
  let current = page("ready");
  const request = vi.fn(async (action: CloudClipboardAction) => {
    if (action.operation === "add") {
      current = page("pending");
      throw { code: "clipboard_device_pending" };
    }
    return current;
  });
  render(<CloudClipboardPanel client={{ close: vi.fn(), request }} />);
  fireEvent.change(await screen.findByRole("textbox", { name: "待上传文本" }), {
    target: { value: "合成上传" },
  });
  fireEvent.click(screen.getByRole("button", { name: "上传明确选择的文本" }));
  expect(await screen.findByText(CLOUD_CLIPBOARD_PENDING)).toBeDefined();
  expect(await screen.findByRole("region", { name: "本设备等待允许" })).toBeDefined();
});

test("the panel no longer claims the server can read uploads", async () => {
  render(
    <CloudClipboardPanel
      client={{ close: vi.fn(), request: host({ list: () => page("ready") }) }}
    />,
  );
  expect(await screen.findByText(/服务器只保存密文/)).toBeDefined();
});

function renderHistory(
  cloudRequest: Parameters<typeof ClipboardHistorySection>[0]["cloudRequest"],
) {
  return render(
    <ClipboardHistorySection
      client={{
        clear: vi.fn(),
        list: vi
          .fn()
          .mockResolvedValue([{ text: "合成记录", timestampMs: 1_700_000_000_000, pinned: false }]),
      }}
      historyEnabled
      persistedHistoryEnabled
      revision={1}
      ios={false}
      onToggle={vi.fn()}
      onError={vi.fn()}
      cloudRequest={cloudRequest}
    />,
  );
}

test("clipboard history keeps sending disabled while this device waits for approval", async () => {
  const cloudRequest = vi.fn().mockResolvedValue(page("pending"));
  renderHistory(cloudRequest);
  expect(await screen.findByText(CLOUD_CLIPBOARD_PENDING)).toBeDefined();
  expect(screen.getByRole("button", { name: "发到云剪贴板" }).hasAttribute("disabled")).toBe(true);
  expect(cloudRequest).toHaveBeenCalledTimes(1);
});

test("clipboard history turns a pending refusal into the approval note", async () => {
  const cloudRequest = vi
    .fn()
    .mockResolvedValueOnce(page("ready"))
    .mockRejectedValueOnce({ code: "clipboard_device_pending" });
  renderHistory(cloudRequest);
  const send = await screen.findByRole("button", { name: "发到云剪贴板" });
  await waitFor(() => expect(send.hasAttribute("disabled")).toBe(false));
  fireEvent.click(send);
  expect(await screen.findByText(CLOUD_CLIPBOARD_PENDING)).toBeDefined();
  expect(send.hasAttribute("disabled")).toBe(true);
});
