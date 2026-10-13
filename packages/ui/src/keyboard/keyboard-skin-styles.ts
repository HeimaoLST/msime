import type { CSSProperties } from "react";
import { clamp } from "../core/number";
import { resolveKeyboardSkinLook } from "./keyboard-skin-look";
import { keyboardBackgroundStyle } from "./keyboard-background";
import { keyboardRgba, mixKeyboardColor, readableKeyboardText } from "./keyboard-colors";
import type { TouchKeyboardSkinDesign } from "./touch-keyboard-skin-design";
import type { GlobalTheme } from "../theme/global-theme";

export function keyboardSkinStyles(
  theme: "dark" | "light",
  skin: GlobalTheme,
  customDesign?: TouchKeyboardSkinDesign,
): CSSProperties {
  const look = resolveKeyboardSkinLook(theme, skin, customDesign);
  const {
    palette,
    cornerRadius,
    borderWidth,
    shadowOpacity,
    shadowOffset,
    shadowRadius,
    keyOpacity,
    keyShape,
    keyMaterial,
    monospaced,
  } = look;
  const keyRadius =
    keyShape === "capsule"
      ? "999px"
      : keyShape === "pebble"
        ? "42% 58% 48% 52% / 52% 44% 56% 48%"
        : keyShape === "ticket"
          ? `${clamp(cornerRadius, 0, 4)}px`
          : `${clamp(cornerRadius, 0, 20)}px`;
  const fontFamily = monospaced ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "inherit";
  return {
    ...keyboardBackgroundStyle(look),
    "--kb-background": palette.background,
    "--kb-text": palette.foreground,
    "--kb-heading": palette.accent,
    "--kb-key": palette.key,
    "--kb-key-fill": keyboardRgba(palette.key, keyOpacity),
    "--kb-action": palette.action,
    "--kb-action-fill": keyboardRgba(palette.action, 1),
    "--kb-action-text": readableKeyboardText(palette.action),
    "--kb-paper-line": keyboardRgba(palette.accent, 0.08),
    "--kb-hover": mixKeyboardColor(palette.key, palette.accent, 0.18),
    "--kb-active": mixKeyboardColor(palette.key, palette.accent, 0.3),
    "--kb-pressed": mixKeyboardColor(palette.key, palette.accent, 0.42),
    "--kb-key-radius": keyRadius,
    "--kb-border-width": `${clamp(borderWidth, 0, 2)}px`,
    "--kb-border-color": palette.accent,
    "--kb-shadow":
      shadowOpacity > 0
        ? `0 ${shadowOffset}px ${shadowRadius}px rgba(0, 0, 0, ${shadowOpacity})`
        : "none",
    "--kb-font-family": fontFamily,
    "--kb-key-material": keyMaterial,
  } as CSSProperties;
}
