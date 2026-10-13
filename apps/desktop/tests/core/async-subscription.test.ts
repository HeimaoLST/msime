import { expect, test, vi } from "vitest";
import { trackAsyncSubscription } from "../../../../packages/ui/src/core/async-subscription";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => (resolve = accept));
  return { promise, resolve };
}

test("stops a subscription when registration resolves after disposal", async () => {
  const pending = deferred<() => void>();
  const stop = vi.fn();
  const dispose = trackAsyncSubscription(pending.promise, () => true);

  dispose();
  pending.resolve(stop);
  await pending.promise;

  expect(stop).toHaveBeenCalledOnce();
});

test("stops stale registrations and disposes a current subscription once", async () => {
  const staleStop = vi.fn();
  const stale = trackAsyncSubscription(Promise.resolve(staleStop), () => false);
  await Promise.resolve();
  expect(staleStop).toHaveBeenCalledOnce();
  stale();
  expect(staleStop).toHaveBeenCalledOnce();

  const currentStop = vi.fn();
  const current = trackAsyncSubscription(Promise.resolve(currentStop), () => true);
  await Promise.resolve();
  expect(currentStop).not.toHaveBeenCalled();
  current();
  current();
  expect(currentStop).toHaveBeenCalledOnce();
});
