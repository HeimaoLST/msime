import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { keyboardSkinStyles } from "../../../../packages/ui/src/keyboard/keyboard-skin-styles";
import { resolveKeyboardSkinLook } from "../../../../packages/ui/src/keyboard/keyboard-skin-look";
import { ScreenKeyboardPreview } from "../../../../packages/ui/src/keyboard/screen-keyboard-preview";
import { defaultTouchKeyboardSkinDesign } from "../../../../packages/ui/src/keyboard/touch-keyboard-skin-design";

test("shares custom palette and key geometry between keyboard styles and preview", () => {
  const design = {
    ...defaultTouchKeyboardSkinDesign,
    keyShape: "ticket" as const,
    keyMaterial: "raised" as const,
    keyOpacity: 0.7,
    cornerRadius: 12,
    pattern: 2 as const,
    monospaced: true,
  };
  const look = resolveKeyboardSkinLook("dark", "custom", design);
  const styles = keyboardSkinStyles("dark", "custom", design) as Record<string, string>;
  const preview = renderToStaticMarkup(
    <ScreenKeyboardPreview theme="dark" skin="custom" customDesign={design} compact />,
  );

  expect(styles["--kb-key"]).toBe(look.palette.key);
  expect(styles["--kb-key-radius"]).toBe("4px");
  expect(styles.backgroundImage).toContain("linear-gradient");
  expect(preview).toContain('data-key-shape="ticket"');
  expect(preview).toContain('data-key-material="raised"');
  expect(preview).toContain('data-preview-skin="custom"');
});

test("ignores a custom design for the native keyboard look", () => {
  const look = resolveKeyboardSkinLook("light", "native", defaultTouchKeyboardSkinDesign);
  expect(look.custom).toBeUndefined();
  expect(look.palette.background).toBe("#E2E3E8");
  expect(look.cornerRadius).toBe(6);
  expect(keyboardSkinStyles("light", "native", defaultTouchKeyboardSkinDesign)).toMatchObject({
    "--kb-background": look.palette.background,
    "--kb-key-radius": "6px",
  });
});
