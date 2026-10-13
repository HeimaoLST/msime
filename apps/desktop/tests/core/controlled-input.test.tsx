// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ControlledInput } from "../../../../packages/ui/src/core/controlled-input";

test("forwards native input attributes and emits the controlled string", () => {
  const onChange = vi.fn();
  render(
    <ControlledInput
      aria-label="地址"
      className="field"
      type="url"
      placeholder="https://example.invalid"
      value="https://old.invalid"
      onChange={onChange}
    />,
  );
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "地址" });
  expect(input.value).toBe("https://old.invalid");
  expect(input.type).toBe("url");
  expect(input.className).toBe("field");
  expect(input.placeholder).toBe("https://example.invalid");
  fireEvent.change(input, { target: { value: "https://new.invalid" } });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("https://new.invalid");
});
