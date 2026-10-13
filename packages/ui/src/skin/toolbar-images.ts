import { rewriteCssImages } from "./css-image-value";
import { preserveAnimationShorthands } from "./animation-shorthand-source";
import { walkCssRulesAsync } from "./css-rules";
import { boundedResourceReader } from "./bounded-resource-reader";

export async function prepareToolbarImages(
  css: string,
  resolve: (relative: string) => Promise<string>,
): Promise<{ css: string; partial: boolean }> {
  const preserved = preserveAnimationShorthands(css);
  css = preserved.css;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  let partial = preserved.partial || /@import\b/i.test(css);
  let expanded = 0;
  const cached = boundedResourceReader(resolve, {
    maxResources: 32,
    countError: "resource count exceeded",
    sizeOf: (data) => data.length,
    validate: (_data, total) => {
      if (total > 16 * 1024 * 1024) throw new Error("resource budget exceeded");
    },
  });
  await walkCssRulesAsync(sheet.cssRules, async (rule) => {
    const nested = rule.constructor.name === "CSSNestedDeclarations";
    if (rule.type !== CSSRule.STYLE_RULE && rule.type !== CSSRule.KEYFRAME_RULE && !nested) return;
    const styleRule = rule as CSSStyleRule;
    for (const property of Array.from(styleRule.style)) {
      // Animation names (including escaped names) are not resource URLs.
      // Preserve unresolved shorthands for the animation isolation pass.
      if (/^(?:-webkit-)?animation(?:-|$)/.test(property)) continue;
      const value = await rewriteCssImages(styleRule.style.getPropertyValue(property), cached);
      expanded += value?.length ?? 0;
      if (value === null || expanded > 16 * 1024 * 1024) {
        styleRule.style.removeProperty(property);
        partial = true;
      } else
        styleRule.style.setProperty(property, value, styleRule.style.getPropertyPriority(property));
    }
  });
  return {
    css: Array.from(sheet.cssRules)
      .map((rule) => rule.cssText)
      .join("\n"),
    partial,
  };
}
