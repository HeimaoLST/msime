// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ControlledSelect } from "../../../../packages/ui/src/core/controlled-select";

test("forwards select attributes and emits the selected string", () => {
  const onChange = vi.fn();
  render(
    <ControlledSelect
      aria-label="类型"
      className="selector"
      disabled={false}
      value="first"
      onChange={onChange}
    >
      <option value="first">第一种</option>
      <option value="second">第二种</option>
    </ControlledSelect>,
  );
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "类型" });
  expect(select.value).toBe("first");
  expect(select.className).toBe("selector");
  expect(select.disabled).toBe(false);
  fireEvent.change(select, { target: { value: "second" } });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("second");
});
