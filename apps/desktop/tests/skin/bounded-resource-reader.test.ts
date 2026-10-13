import { expect, test, vi } from "vitest";
import { boundedResourceReader } from "../../../../packages/ui/src/skin/bounded-resource-reader";

test("reuses a pending package read and counts each distinct path once", async () => {
  let finish!: (value: string) => void;
  const resolve = vi.fn(() => new Promise<string>((accept) => (finish = accept)));
  const read = boundedResourceReader(resolve, {
    maxResources: 1,
    countError: "resource count exceeded",
    sizeOf: (value) => value.length,
    validate: () => {},
  });

  const first = read("first.png");
  expect(read("first.png")).toBe(first);
  await expect(read("second.png")).rejects.toThrow("resource count exceeded");
  finish("data");
  await expect(first).resolves.toBe("data");
  expect(resolve).toHaveBeenCalledExactlyOnceWith("first.png");
});

test("tracks a cumulative size budget across distinct resources", async () => {
  const resolve = vi.fn(async (relative: string) => relative);
  const read = boundedResourceReader(resolve, {
    maxResources: 3,
    countError: "resource count exceeded",
    sizeOf: (value) => value.length,
    validate: (_value, total) => {
      if (total > 5) throw new Error("resource budget exceeded");
    },
  });

  await expect(read("abc")).resolves.toBe("abc");
  await expect(read("de")).resolves.toBe("de");
  await expect(read("f")).rejects.toThrow("resource budget exceeded");
  await expect(read("f")).rejects.toThrow("resource budget exceeded");
  expect(resolve).toHaveBeenCalledTimes(3);
});
