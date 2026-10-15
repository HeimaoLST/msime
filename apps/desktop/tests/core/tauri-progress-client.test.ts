import { expect, test, vi } from "vitest";
import { createTauriProgressClient } from "../../src/core/tauri-progress-client";

test("maps common progress resource commands and unwraps event payload", async () => {
  const invoke = vi.fn(async () => "result");
  let receive!: (event: { payload: { id: string; downloaded: number } }) => void;
  const listen = vi.fn(async (_name: string, handler: typeof receive) => {
    receive = handler;
    return vi.fn();
  });
  const client = createTauriProgressClient<{ id: string }[], { id: string; downloaded: number }>(
    invoke as never,
    listen as never,
    {
      list: "synthetic_list",
      install: "synthetic_install",
      cancel: "synthetic_cancel",
      progress: "synthetic-progress",
    },
  );
  const progress = vi.fn();
  await client.list();
  await client.install("item");
  await client.cancel("item");
  await client.onProgress(progress);
  receive({ payload: { id: "item", downloaded: 3 } });
  expect(invoke.mock.calls).toEqual([
    ["synthetic_list"],
    ["synthetic_install", { id: "item" }],
    ["synthetic_cancel", { id: "item" }],
  ]);
  expect(listen).toHaveBeenCalledWith("synthetic-progress", expect.any(Function));
  expect(progress).toHaveBeenCalledWith({ id: "item", downloaded: 3 });
});
