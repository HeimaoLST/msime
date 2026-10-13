// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountVerificationCodeField } from "../../../../packages/ui/src/account/account-verification-code-field";

afterEach(cleanup);

test("verification code input keeps only six ASCII digits across account layouts", () => {
  const onChange = vi.fn();
  const { rerender } = render(<AccountVerificationCodeField value="" onChange={onChange} />);
  const input = screen.getByRole("textbox", { name: "6 位验证码" }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "12a３34567" } });
  expect(onChange).toHaveBeenCalledWith("123456");
  expect(input.maxLength).toBe(6);
  expect(input.autocomplete).toBe("one-time-code");

  rerender(
    <AccountVerificationCodeField
      value="123456"
      onChange={onChange}
      visuallyHiddenLabel
      className="sheet-input"
      placeholder="6 位验证码"
    />,
  );
  expect(screen.getByRole("textbox", { name: "6 位验证码" }).className).toBe("sheet-input");
  expect(screen.getByText("6 位验证码", { selector: ".sr-only" })).not.toBeNull();
});
