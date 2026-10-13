// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountNicknameEditor } from "../../../../packages/ui/src/account/account-nickname-editor";

afterEach(cleanup);

test("mobile nickname editor shows validation guidance and a codepoint count", () => {
  const onChange = vi.fn();
  render(
    <AccountNicknameEditor
      variant="mobile"
      value={"invalid\nname"}
      normalizedName={"invalid\nname"}
      validName={false}
      disabled={false}
      onChange={onChange}
    />,
  );
  expect(screen.getByText("昵称最多 64 个字符，请勿使用换行或控制字符。")).not.toBeNull();
  expect(screen.getByText("12/64")).not.toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "编辑社区昵称" }), {
    target: { value: "Next User" },
  });
  expect(onChange).toHaveBeenCalledWith("Next User");
});

test("sheet and desktop nickname editors keep their distinct presentation", () => {
  const props = {
    value: "合成👋",
    normalizedName: "合成👋",
    validName: true,
    disabled: false,
    onChange: vi.fn(),
  };
  const { rerender } = render(<AccountNicknameEditor variant="sheet" {...props} />);
  expect(screen.getByText("3/64")).not.toBeNull();
  expect(screen.getByText("社区昵称").className).toContain("sr-only");
  expect(screen.getByRole("textbox", { name: "编辑社区昵称" }).className).toContain("h-[50px]");

  rerender(<AccountNicknameEditor variant="desktop" {...props} />);
  expect(screen.getByText("昵称会显示在社区作品中，已发布的作品也会同步更新。")).not.toBeNull();
  expect(screen.queryByText("3/64")).toBeNull();
});
