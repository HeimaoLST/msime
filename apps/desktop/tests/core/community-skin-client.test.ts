import { expect, test, vi } from "vitest";
import { createCommunitySkinClient } from "@msime/ui";

test("community skin client builds the shared nine-operation contract", async () => {
  const request = vi.fn(async () => undefined);
  const client = createCommunitySkinClient(
    request as unknown as Parameters<typeof createCommunitySkinClient>[0],
  );
  const id = "10000000-0000-4000-8000-000000000001";
  const design = { background: 0x123456 } as never;

  await client.list(20, "水墨", true, "guofeng");
  await client.detail(id);
  await client.download(id, "晨雾");
  await client.rate(id, 4);
  await client.publish(id, "晨雾", "说明", design, "minimal");
  await client.unpublish(id);
  await client.setCategory(id, "food");
  await client.finishTrial(id, false);
  await client.report?.(id, "垃圾广告", "重复内容");

  expect(request.mock.calls).toEqual([
    ["list", { offset: 20, search: "水墨", mine: true, category: "guofeng" }],
    ["detail", { id }],
    ["download", { id, name: "晨雾" }],
    ["rate", { id, stars: 4 }],
    ["publish", { id, name: "晨雾", description: "说明", design, category: "minimal" }],
    ["unpublish", { id }],
    ["set_category", { id, category: "food" }],
    ["finish_trial", { id, keep: false }],
    ["report", { id, reason: "垃圾广告", detail: "重复内容" }],
  ]);
});
