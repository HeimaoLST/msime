// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LabeledInputField } from "../../../../packages/ui/src/core/labeled-input-field";

test("forwards input attributes and emits the controlled value", () => {
  const onChange = vi.fn();
  render(
    <LabeledInputField
      label="名称"
      ariaLabel="名称"
      value="旧值"
      className="input"
      labelClassName="field"
      placeholder="请输入"
      onChange={onChange}
    />,
  );
  const input = screen.getByRole("textbox", { name: "名称" });
  expect(input.className).toBe("input");
  expect(input.parentElement?.className).toBe("field");
  expect(input.getAttribute("placeholder")).toBe("请输入");
  fireEvent.change(input, { target: { value: "新值" } });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("新值");
});
