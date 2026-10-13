// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAccountRename } from "../../../../packages/ui/src/account/use-account-rename";

afterEach(cleanup);

const profile = {
  user: {
    id: "synthetic-user",
    displayName: "Synthetic User",
    createdAt: "2026-01-01T00:00:00Z",
  },
  providers: ["email"],
};

test("rename validates and normalizes the name before publishing the profile", async () => {
  const client = { rename: vi.fn().mockResolvedValue(profile) };
  const onRenamed = vi.fn();
  const { result } = renderHook(() =>
    useAccountRename({
      client,
      name: "  Synthetic User  ",
      mounted: { current: true },
      clientGeneration: { current: 1 },
      perform: (operation) => operation(),
      onRenamed,
    }),
  );

  expect(result.current.normalizedName).toBe("Synthetic User");
  expect(result.current.validName).toBe(true);
  await result.current.rename();
  expect(client.rename).toHaveBeenCalledWith("Synthetic User");
  expect(onRenamed).toHaveBeenCalledWith(profile);
});

test("rename rejects invalid names and ignores a result from an old client", async () => {
  const invalidClient = { rename: vi.fn() };
  const invalid = renderHook(() =>
    useAccountRename({
      client: invalidClient,
      name: "\n",
      mounted: { current: true },
      clientGeneration: { current: 1 },
      perform: (operation) => operation(),
      onRenamed: vi.fn(),
    }),
  );
  await expect(invalid.result.current.rename()).rejects.toMatchObject({ code: "account_invalid" });
  expect(invalidClient.rename).not.toHaveBeenCalled();

  let resolve!: (value: typeof profile) => void;
  const client = {
    rename: vi.fn(() => new Promise<typeof profile>((done) => (resolve = done))),
  };
  const onRenamed = vi.fn();
  const clientGeneration = { current: 1 };
  const { result } = renderHook(() =>
    useAccountRename({
      client,
      name: "Synthetic User",
      mounted: { current: true },
      clientGeneration,
      perform: (operation) => operation(),
      onRenamed,
    }),
  );
  const pending = result.current.rename();
  clientGeneration.current = 2;
  resolve(profile);
  await pending;
  expect(onRenamed).not.toHaveBeenCalled();
});
