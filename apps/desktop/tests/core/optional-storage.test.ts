// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  readOptionalJson,
  readOptionalStorage,
  writeOptionalJson,
  writeOptionalStorage,
} from "../../../../packages/ui/src/core/optional-storage";

const key = "test.optional-storage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(key);
});

test("stores strings and JSON values when storage is available", () => {
  writeOptionalStorage(key, "copy");
  expect(readOptionalStorage(key)).toBe("copy");
  writeOptionalJson(key, ["--allow-write"]);
  expect(readOptionalJson(key)).toEqual(["--allow-write"]);
});

test("returns null for malformed JSON and denied storage reads", () => {
  window.localStorage.setItem(key, "invalid JSON");
  expect(readOptionalJson(key)).toBeNull();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage denied");
  });
  expect(readOptionalStorage(key)).toBeNull();
  expect(readOptionalJson(key)).toBeNull();
});

test("ignores denied storage writes and unserializable JSON", () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage denied");
  });
  expect(() => writeOptionalStorage(key, "input")).not.toThrow();
  expect(() => writeOptionalJson(key, ["--allow-write"])).not.toThrow();
  const circular: { self?: unknown } = {};
  circular.self = circular;
  expect(() => writeOptionalJson(key, circular)).not.toThrow();
  expect(setItem).toHaveBeenCalledTimes(2);
});
