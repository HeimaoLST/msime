// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PunctuationSection } from "@msime/ui";
import { PhonePunctuationSection } from "../../../../packages/ui/src/settings/punctuation-section";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("punctuation controls use existing defaults and send focused preference patches", () => {
  const onChange = vi.fn();
  render(
    <PunctuationSection
      preferences={{ chinese_punctuation: true }}
      showCharacterWidth={false}
      onChange={onChange}
    />,
  );

  expect((screen.getByRole("switch", { name: "中文标点" }) as HTMLInputElement).checked).toBe(true);
  expect(
    (screen.getByRole("switch", { name: /^成对标点自动补全/ }) as HTMLInputElement).checked,
  ).toBe(true);
  expect((screen.getByRole("switch", { name: /^智能标点/ }) as HTMLInputElement).checked).toBe(
    false,
  );
  expect(screen.queryByRole("switch", { name: "全角输入" })).toBeNull();

  fireEvent.click(screen.getByRole("switch", { name: /^智能标点/ }));
  expect(onChange).toHaveBeenLastCalledWith({ smart_punctuation: true });
  fireEvent.click(screen.getByRole("switch", { name: /^字母后直出/ }));
  expect(onChange).toHaveBeenLastCalledWith({ smart_punctuation_direct_letter: true });
  fireEvent.change(screen.getByRole("combobox", { name: "固定标点" }), {
    target: { value: "english" },
  });
  expect(onChange).toHaveBeenLastCalledWith({ punctuation_lock: "english" });
});

test("fullwidth control appears only when the host supports it", () => {
  const onChange = vi.fn();
  render(
    <PunctuationSection
      preferences={{ chinese_punctuation: true, character_width: "fullwidth" }}
      showCharacterWidth
      onChange={onChange}
    />,
  );

  const fullwidth = screen.getByRole("switch", { name: "全角输入" }) as HTMLInputElement;
  expect(fullwidth.checked).toBe(true);
  fireEvent.click(fullwidth);
  expect(onChange).toHaveBeenLastCalledWith({ character_width: "halfwidth" });
});

test("caps lock punctuation switch appears only on a host that reports caps lock and starts off", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <PunctuationSection
      preferences={{ chinese_punctuation: true }}
      showCharacterWidth={false}
      onChange={onChange}
    />,
  );
  expect(screen.queryByRole("switch", { name: /^大写锁定时使用英文标点/ })).toBeNull();

  rerender(
    <PunctuationSection
      preferences={{ chinese_punctuation: true }}
      showCharacterWidth={false}
      showCapsLockPunctuation
      onChange={onChange}
    />,
  );
  const capsLock = screen.getByRole("switch", {
    name: /^大写锁定时使用英文标点/,
  }) as HTMLInputElement;
  expect(capsLock.checked).toBe(false);
  fireEvent.click(capsLock);
  expect(onChange).toHaveBeenLastCalledWith({ caps_lock_ascii_punctuation: true });
});

test("quote and bracket styles follow 中文标点, show their defaults and send their stored values", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <PunctuationSection
      preferences={{ chinese_punctuation: true }}
      showCharacterWidth={false}
      onChange={onChange}
    />,
  );
  const quotes = () => screen.getByRole("combobox", { name: /^引号样式/ }) as HTMLSelectElement;
  const brackets = () =>
    screen.getByRole("combobox", { name: /^方头括号样式/ }) as HTMLSelectElement;
  // 文档里没有这两个键时显示缺省值。
  expect(quotes().value).toBe("curly");
  expect(brackets().value).toBe("solid");
  expect(Array.from(quotes().options).map((option) => option.value)).toEqual([
    "curly",
    "corner",
    "corner_when_traditional",
  ]);
  // 两行紧跟在「中文标点」之后，排在智能标点那几行前面。
  const controls = Array.from(document.querySelectorAll("input, select"));
  const chinese = controls.indexOf(screen.getByRole("switch", { name: "中文标点" }));
  expect(controls.indexOf(quotes())).toBe(chinese + 1);
  expect(controls.indexOf(brackets())).toBe(chinese + 2);
  expect(controls.indexOf(screen.getByRole("switch", { name: /^智能标点/ }))).toBeGreaterThan(
    chinese + 2,
  );

  fireEvent.change(quotes(), { target: { value: "corner" } });
  expect(onChange).toHaveBeenLastCalledWith({ quote_style: "corner" });
  fireEvent.change(brackets(), { target: { value: "hollow" } });
  expect(onChange).toHaveBeenLastCalledWith({ bracket_style: "hollow" });

  rerender(
    <PunctuationSection
      preferences={{
        chinese_punctuation: true,
        quote_style: "corner_when_traditional",
        bracket_style: "hollow",
      }}
      showCharacterWidth={false}
      onChange={onChange}
    />,
  );
  expect(quotes().value).toBe("corner_when_traditional");
  expect(brackets().value).toBe("hollow");
});

test("the HarmonyOS phone section keeps both styles under 更多选项", () => {
  const onChange = vi.fn();
  render(
    <PhonePunctuationSection preferences={{ chinese_punctuation: true }} onChange={onChange} />,
  );
  const quotes = screen.getByRole("combobox", { name: /^引号样式/ }) as HTMLSelectElement;
  const brackets = screen.getByRole("combobox", { name: /^方头括号样式/ }) as HTMLSelectElement;
  expect(quotes.closest("details")?.textContent).toContain("更多选项");
  expect(brackets.closest("details")).toBe(quotes.closest("details"));
  fireEvent.change(quotes, { target: { value: "corner" } });
  expect(onChange).toHaveBeenLastCalledWith({ quote_style: "corner" });
});
