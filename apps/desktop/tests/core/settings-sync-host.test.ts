import { expect, test, vi } from "vitest";
import { createSettingsSyncClient } from "../../src/core/settings-sync-host";

test("settings sync bridge forwards the four account preference commands", async () => {
  const invoke = vi.fn(async () => undefined);
  const sync = createSettingsSyncClient(
    invoke as unknown as Parameters<typeof createSettingsSyncClient>[0],
  );
  const preferences = { revision: 4, settings: { "input.learning": false } };

  await sync.schema();
  await sync.load();
  await sync.upload();
  await sync.apply("synthetic-user", preferences);

  expect(invoke.mock.calls).toEqual([
    ["account_preferences_schema"],
    ["account_preferences_load"],
    ["account_preferences_upload"],
    ["account_preferences_apply", { userId: "synthetic-user", preferences }],
  ]);
});
