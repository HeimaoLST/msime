// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "../../../../packages/ui/src/core/toast";
import { useHostAction } from "../../../../packages/ui/src/core/use-host-action";

afterEach(cleanup);

function Harness({ action }: { action?: () => Promise<void> }) {
  const run = useHostAction();
  return (
    <button type="button" onClick={() => run(action)}>
      执行
    </button>
  );
}

test("runs the host action immediately and stays quiet when it succeeds", async () => {
  const action = vi.fn().mockResolvedValue(undefined);
  render(
    <ToastProvider>
      <Harness action={action} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "执行" }));
  await act(async () => await Promise.resolve());
  expect(action).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("");
});

test("maps a rejected host action to the existing toast error", async () => {
  const action = vi.fn().mockRejectedValue(new Error("合成宿主失败"));
  render(
    <ToastProvider>
      <Harness action={action} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "执行" }));
  expect(await screen.findByText("合成宿主失败")).toBeTruthy();
});

test("stays quiet when a host action rejects without a toast provider", async () => {
  const action = vi.fn().mockRejectedValue(new Error("合成宿主失败"));
  render(<Harness action={action} />);
  fireEvent.click(screen.getByRole("button", { name: "执行" }));
  await act(async () => await Promise.resolve());
  expect(action).toHaveBeenCalledOnce();
  expect(screen.queryByRole("status")).toBeNull();
});
