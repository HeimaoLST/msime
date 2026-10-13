// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountProfileActions } from "../../../../packages/ui/src/account/account-profile-actions";

afterEach(cleanup);

test("mobile profile actions include relogin and select the requested confirmation", () => {
  const onSelect = vi.fn();
  render(<AccountProfileActions variant="mobile" busy={false} onSelect={onSelect} />);

  expect(screen.getByRole("heading", { name: "账号操作" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "退出所有设备" }));
  fireEvent.click(screen.getByRole("button", { name: "重新登录" }));
  expect(onSelect).toHaveBeenNthCalledWith(1, "logout-all");
  expect(onSelect).toHaveBeenNthCalledWith(2, "relogin");
});

test("Harmony profile actions group logout and deletion without relogin", () => {
  const onSelect = vi.fn();
  render(<AccountProfileActions variant="harmony" busy={true} onSelect={onSelect} />);
  expect(screen.queryByRole("button", { name: "重新登录" })).toBeNull();
  expect((screen.getByRole("button", { name: "注销账号" }) as HTMLButtonElement).disabled).toBe(
    true,
  );

  cleanup();
  render(<AccountProfileActions variant="harmony" busy={false} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: "注销账号" }));
  expect(onSelect).toHaveBeenCalledWith("delete");
});
