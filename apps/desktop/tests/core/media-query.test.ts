import { expect, test, vi } from "vitest";
import { subscribeMediaQuery } from "../../../../packages/ui/src/core/media-query";

test("subscribes and removes a modern media query listener", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const media = { addEventListener, removeEventListener } as unknown as MediaQueryList;
  const listener = vi.fn();

  const dispose = subscribeMediaQuery(media, listener);

  expect(addEventListener).toHaveBeenCalledWith("change", listener);
  dispose();
  expect(removeEventListener).toHaveBeenCalledWith("change", listener);
});

test("falls back to the legacy media query listener API", () => {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const media = { addListener, removeListener } as unknown as MediaQueryList;
  const listener = vi.fn();

  const dispose = subscribeMediaQuery(media, listener);

  expect(addListener).toHaveBeenCalledWith(listener);
  dispose();
  expect(removeListener).toHaveBeenCalledWith(listener);
});

const mediaQueryConsumers = import.meta.glob<string>(
  [
    "../../../../packages/ui/src/candidate/candidate-preview-theme.ts",
    "../../../../packages/ui/src/skin/conditional-fonts.ts",
    "../../../../packages/ui/src/settings/use-settings-theme.ts",
    "../../../../packages/ui/src/theme/settings-platform.ts",
  ],
  { eager: true, query: "?raw", import: "default" },
);

test.each(Object.entries(mediaQueryConsumers))(
  "%s 复用公共媒体查询订阅生命周期",
  (_path, source) => {
    expect(source).toContain('from "../core/media-query"');
    expect(source).not.toContain('.addEventListener("change"');
    expect(source).not.toContain('.removeEventListener("change"');
    expect(source).not.toContain(".addListener(");
    expect(source).not.toContain(".removeListener(");
  },
);

const harmonyMediaQueryConsumers = import.meta.glob<string>(
  ["../../../../apps/harmony/src/main.tsx"],
  { eager: true, query: "?raw", import: "default" },
);

test.each(Object.entries(harmonyMediaQueryConsumers))(
  "%s 复用公共媒体查询订阅生命周期",
  (_path, source) => {
    expect(source).toContain('from "@msime/ui"');
    expect(source).toContain("subscribeMediaQuery(media, apply)");
    expect(source).not.toContain('media.addEventListener("change"');
    expect(source).not.toContain('media.removeEventListener("change"');
    expect(source).not.toContain("media.addListener(");
    expect(source).not.toContain("media.removeListener(");
  },
);
