import { expect, test } from "vitest";
import { formatDateTime, formatZhDate, formatZhMonthDay } from "@msime/ui";

test("formats valid dates with the shared Chinese date locale", () => {
  expect(formatZhDate("2026-10-04T12:00:00Z")).toBe(
    new Date("2026-10-04T12:00:00Z").toLocaleDateString("zh-CN"),
  );
});

test("returns an empty label for invalid dates", () => {
  expect(formatZhDate("not-a-date")).toBe("");
});

test("formats a local date as a Chinese month and day label", () => {
  expect(formatZhMonthDay(new Date(2026, 9, 4))).toBe("10月4日");
});

test("formats date and time with the requested locale", () => {
  const value = "2026-10-04T12:34:56Z";
  expect(formatDateTime(value, "zh-CN")).toBe(new Date(value).toLocaleString("zh-CN"));
});

test("returns an empty label for invalid date and time values", () => {
  expect(formatDateTime("not-a-date")).toBe("");
});
