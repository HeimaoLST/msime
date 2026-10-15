import { expect, test, vi } from "vitest";
import { createCommunityResourceClient } from "../../src/core/community-resource-host";

test("creates the shared community resource bridge and keeps reply actions opt-in", async () => {
  const invoke = vi.fn(async () => undefined);
  const desktop = createCommunityResourceClient(
    invoke as unknown as Parameters<typeof createCommunityResourceClient>[0],
  );
  const mobile = createCommunityResourceClient(
    invoke as unknown as Parameters<typeof createCommunityResourceClient>[0],
    { includeReplyActions: true },
  );
  const id = "10000000-0000-4000-8000-000000000010";

  await desktop.list("dictionary", "mine", "合成", 3);
  await desktop.report?.("dictionary", id, "垃圾广告", "合成说明");
  expect(desktop.storeReply).toBeUndefined();
  expect(desktop.removeReply).toBeUndefined();
  await mobile.storeReply?.({ id } as never);
  await mobile.removeReply?.(id);

  expect(invoke.mock.calls).toEqual([
    ["community_resource_list", { kind: "dictionary", scope: "mine", search: "合成", offset: 3 }],
    ["community_report", { kind: "dictionaries", id, reason: "垃圾广告", detail: "合成说明" }],
    ["community_resource_store_reply", { item: { id } }],
    ["community_resource_remove_reply", { id }],
  ]);
});
