// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ControlledCheckbox } from "../../../../packages/ui/src/core/controlled-checkbox";

test("forwards checkbox attributes and emits the checked boolean", () => {
  const onChange = vi.fn();
  render(
    <ControlledCheckbox aria-label="启用" className="toggle" checked={false} onChange={onChange} />,
  );
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox", { name: "启用" });
  expect(checkbox.type).toBe("checkbox");
  expect(checkbox.checked).toBe(false);
  expect(checkbox.className).toBe("toggle");
  fireEvent.click(checkbox);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
});
