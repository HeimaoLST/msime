import { expect, test, vi } from "vitest";
import { runAccountSessionAction } from "../../../../packages/ui/src/account/use-account-session-actions";

test("dispatches each account session choice to the matching operation", () => {
  const signOut = vi.fn();
  const deleteAccount = vi.fn();
  const operations = { signOut, deleteAccount };

  runAccountSessionAction("logout", operations);
  runAccountSessionAction("logout-all", operations);
  runAccountSessionAction("delete", operations);

  expect(signOut.mock.calls).toEqual([[false], [true]]);
  expect(deleteAccount).toHaveBeenCalledOnce();
});
