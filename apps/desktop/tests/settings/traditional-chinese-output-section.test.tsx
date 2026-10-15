// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TraditionalChineseOutputSection } from "@msime/ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("without variant support the choice is simplified or traditional", () => {
  const onChange = vi.fn();
  render(<TraditionalChineseOutputSection value={false} onChange={onChange} />);

  const group = screen.getByRole("radiogroup", { name: "中文输出" });
  expect(
    within(group)
      .getAllByRole("radio")
      .map((radio) => radio.parentElement?.textContent),
  ).toEqual(["简体", "繁体"]);
  expect((screen.getByRole("radio", { name: "简体" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "繁体" }));
  expect(onChange).toHaveBeenCalledWith({ traditional_chinese_output: true });
});

test("a host without variant support shows a stored Taiwan variant as traditional and keeps it", () => {
  const onChange = vi.fn();
  render(<TraditionalChineseOutputSection value={false} variant="s2twp" onChange={onChange} />);

  fireEvent.click(screen.getByRole("radio", { name: "繁体" }));
  expect(onChange).toHaveBeenCalledWith({ traditional_chinese_output: true });
});

test("with variant support the Taiwan configurations are listed and saved", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <TraditionalChineseOutputSection value={true} variants onChange={onChange} />,
  );

  expect((screen.getByRole("radio", { name: "繁体" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "台湾正体" }));
  expect(onChange).toHaveBeenLastCalledWith({
    traditional_chinese_output: true,
    traditional_chinese_variant: "s2tw",
  });
  fireEvent.click(screen.getByRole("radio", { name: "台湾用词" }));
  expect(onChange).toHaveBeenLastCalledWith({
    traditional_chinese_output: true,
    traditional_chinese_variant: "s2twp",
  });

  rerender(
    <TraditionalChineseOutputSection value={true} variant="s2twp" variants onChange={onChange} />,
  );
  expect((screen.getByRole("radio", { name: "台湾用词" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText(/軟體/)).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "简体" }));
  expect(onChange).toHaveBeenLastCalledWith({ traditional_chinese_output: false });
  fireEvent.click(screen.getByRole("radio", { name: "繁体" }));
  expect(onChange).toHaveBeenLastCalledWith({
    traditional_chinese_output: true,
    traditional_chinese_variant: "s2t",
  });
});

test("simplified is selected by default", () => {
  render(<TraditionalChineseOutputSection value={undefined} variants onChange={vi.fn()} />);

  expect((screen.getByRole("radio", { name: "简体" }) as HTMLInputElement).checked).toBe(true);
});

test.each(["cantonese", "zhuyin"] as const)(
  "%s says the choice does not change its Traditional output",
  (scheme) => {
    render(<TraditionalChineseOutputSection value={false} scheme={scheme} onChange={vi.fn()} />);

    expect(screen.getByText(/粤拼与注音直接输出繁体，此选项不影响它们/)).toBeTruthy();
  },
);

test("Stroke says the choice does not convert the character picked", () => {
  render(<TraditionalChineseOutputSection value={false} scheme="stroke" onChange={vi.fn()} />);

  expect(screen.getByText(/笔画按所选的字原样输出，此选项不影响它/)).toBeTruthy();
  expect(screen.queryByText(/粤拼与注音/)).toBeNull();
});

test("pinyin schemes keep the plain description", () => {
  render(<TraditionalChineseOutputSection value={false} scheme="quanpin" onChange={vi.fn()} />);

  expect(screen.queryByText(/粤拼与注音/)).toBeNull();
  expect(screen.queryByText(/笔画/)).toBeNull();
});
