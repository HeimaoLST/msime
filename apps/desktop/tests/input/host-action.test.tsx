// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HostActionButton } from "../../../../packages/ui/src/keyboard/HostActionButton";

afterEach(cleanup);

test("missing host capability disables the action", () => {
  render(<HostActionButton label="复制群号" />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
});

test("StrictMode 重放后宿主动作可完成并继续操作", async () => {
  const action = vi.fn().mockResolvedValue(undefined);
  render(
    <StrictMode>
      <HostActionButton label="打开" success="完成" action={action} />
    </StrictMode>,
  );

  const button = screen.getByRole("button");
  fireEvent.click(button);
  expect((await screen.findByRole("status")).textContent).toBe("完成");
  expect(button).toHaveProperty("disabled", false);
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  expect(action).toHaveBeenCalledTimes(2);
});

test("copy waits for completion and suppresses duplicate requests", async () => {
  let finish!: () => void;
  const action = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<HostActionButton label="复制群号" success="已复制" action={action} />);
  const button = screen.getByRole("button");
  fireEvent.click(button);
  fireEvent.click(button);
  expect(action).toHaveBeenCalledTimes(1);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("status")).toBeNull();
  finish();
  expect((await screen.findByRole("status")).textContent).toBe("已复制");
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
});

test("host rejection is redacted and a subsequent attempt can succeed", async () => {
  const action = vi
    .fn()
    .mockRejectedValueOnce(new Error("synthetic-host-detail"))
    .mockResolvedValue(undefined);
  render(<HostActionButton label="打开" success="完成" action={action} />);
  fireEvent.click(screen.getByRole("button"));
  expect((await screen.findByRole("alert")).textContent).toBe("操作失败，请重试。");
  expect(screen.queryByText(/synthetic-host-detail/)).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("status");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(action).toHaveBeenCalledTimes(2);
});

test("synchronous host failure is handled too", async () => {
  render(
    <HostActionButton
      label="打开"
      action={() => {
        throw new Error("synthetic-host-detail");
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("alert");
});

test.each([
  { code: "unknown_skin", error: "自定义提示", expected: "找不到该外部皮肤，请先刷新皮肤目录。" },
  { code: "invalid_skin", error: "自定义提示", expected: "皮肤标识无效，未执行应用。" },
  { code: "synthetic_other", error: "自定义提示", expected: "自定义提示" },
  { code: "synthetic_other", error: "", expected: "" },
])("宿主错误 $code 只显示约定文案（$expected）", async ({ code, error, expected }) => {
  const action = vi.fn().mockRejectedValue({ code, detail: "synthetic-host-detail" });
  render(<HostActionButton label="打开" action={action} error={error} />);
  const button = screen.getByRole("button");
  fireEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toBe(expected);
  expect(screen.queryByText(/synthetic-host-detail/)).toBeNull();
  expect(button).toHaveProperty("disabled", false);
  expect(button.getAttribute("aria-busy")).toBe("false");
});

test("父页更换回调时，已经提交的操作仍保持忙碌并显示完成反馈", async () => {
  let finish!: () => void;
  const oldAction = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const nextAction = vi.fn(async () => undefined);
  const view = render(<HostActionButton label="打开" success="完成" action={oldAction} />);
  const button = screen.getByRole("button");
  fireEvent.click(button);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.textContent).toBe("处理中…");
  view.rerender(<HostActionButton label="打开" success="完成" action={nextAction} />);
  expect(button).toHaveProperty("disabled", true);
  await act(async () => finish());
  expect(screen.getByRole("status").textContent).toBe("完成");
  expect(button).toHaveProperty("disabled", false);
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  expect(oldAction).toHaveBeenCalledTimes(1);
  expect(nextAction).toHaveBeenCalledTimes(1);
});
