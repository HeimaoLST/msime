// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAccountRecoveryActions } from "../../../../packages/ui/src/account/use-account-recovery-actions";

afterEach(cleanup);

test("recovery actions publish only results from the current client generation", async () => {
  const providers = { email: true, phone: false };
  let resolveProviders!: (value: typeof providers) => void;
  let resolveClear!: () => void;
  const client = {
    providers: vi.fn(() => new Promise<typeof providers>((done) => (resolveProviders = done))),
    clearExpired: vi.fn(() => new Promise<void>((done) => (resolveClear = done))),
  };
  const onProvidersChange = vi.fn();
  const onClearedExpired = vi.fn();
  const clientGeneration = { current: 1 };
  const { result } = renderHook(() =>
    useAccountRecoveryActions({
      client,
      mounted: { current: true },
      clientGeneration,
      perform: (operation) => operation(),
      onProvidersChange,
      onClearedExpired,
    }),
  );

  const refresh = result.current.refreshProviders();
  expect(client.providers).toHaveBeenCalledOnce();
  clientGeneration.current = 2;
  resolveProviders(providers);
  await refresh;
  expect(onProvidersChange).not.toHaveBeenCalled();

  const clear = result.current.clearExpired();
  expect(client.clearExpired).toHaveBeenCalledOnce();
  clientGeneration.current = 3;
  resolveClear();
  await clear;
  expect(onClearedExpired).not.toHaveBeenCalled();
});

test("recovery actions publish current provider and clear results", async () => {
  const providers = { email: false, phone: true };
  const onProvidersChange = vi.fn();
  const onClearedExpired = vi.fn();
  const { result } = renderHook(() =>
    useAccountRecoveryActions({
      client: {
        providers: vi.fn().mockResolvedValue(providers),
        clearExpired: vi.fn().mockResolvedValue(undefined),
      },
      mounted: { current: true },
      clientGeneration: { current: 1 },
      perform: (operation) => operation(),
      onProvidersChange,
      onClearedExpired,
    }),
  );

  await result.current.refreshProviders();
  await result.current.clearExpired();
  expect(onProvidersChange).toHaveBeenCalledWith(providers);
  expect(onClearedExpired).toHaveBeenCalledOnce();
});
