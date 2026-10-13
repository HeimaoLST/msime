// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { HandwritingPadPreview } from "../../../../packages/ui/src/settings/handwriting-pad-preview";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const phase = (root: HTMLElement) =>
  root.querySelector("[data-handwriting-preview]")?.getAttribute("data-handwriting-preview");

// 一笔一笔写出「水」（四笔，每笔 420ms，笔间停 140ms），写完按识别等待时间停顿，然后候选栏出候选、手写板清空，再写下一遍。拖动等待时间，候选出来得就快或慢。
test("the preview writes, waits the recognition delay, then shows candidates and starts over", () => {
  vi.useFakeTimers();
  const { container } = render(
    <HandwritingPadPreview
      theme="light"
      skin="system"
      delayMs={900}
      strokeColor="blue"
      strokeWidth={6}
    />,
  );
  const svg = container.querySelector("svg")!;
  expect(svg.getAttribute("stroke")).toBe("#2F6FDB");
  // 笔迹 6vp 画在 120 宽的格子、100 单位的 viewBox 里。
  expect(svg.getAttribute("stroke-width")).toBe("5");
  expect(phase(container)).toBe("writing");
  expect(container.textContent).not.toContain("水");

  act(() => {
    vi.advanceTimersByTime(4 * 420 + 3 * 140);
  });
  expect(phase(container)).toBe("waiting");
  act(() => {
    vi.advanceTimersByTime(899);
  });
  expect(phase(container)).toBe("waiting");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(phase(container)).toBe("recognized");
  expect(container.textContent).toContain("水永小求冰");
  expect(container.querySelector("svg")).toBeNull();

  act(() => {
    vi.advanceTimersByTime(1600);
  });
  expect(phase(container)).toBe("writing");
  expect(container.querySelector("svg")).toBeTruthy();
});
