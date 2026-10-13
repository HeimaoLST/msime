// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ControlledTextarea } from "../../../../packages/ui/src/core/controlled-textarea";

test("forwards textarea attributes and emits the controlled value", () => {
  const onChange = vi.fn();
  render(
    <ControlledTextarea
      aria-label="说明"
      className="textarea"
      placeholder="请输入说明"
      rows={4}
      value="旧说明"
      onChange={onChange}
    />,
  );
  const textarea = screen.getByRole("textbox", { name: "说明" });
  expect(textarea.className).toBe("textarea");
  expect(textarea.getAttribute("placeholder")).toBe("请输入说明");
  expect(textarea.getAttribute("rows")).toBe("4");
  fireEvent.change(textarea, { target: { value: "新说明" } });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("新说明");
});
