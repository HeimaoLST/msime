import type { InputScheme } from "../index";
import { SegmentedRow } from "./segmented-row";

/** 繁体输出用的 OpenCC 配置，与偏好 `traditional_chinese_variant` 的取值相同。 */
export type TraditionalChineseVariant = "s2t" | "s2tw" | "s2twp";

/** 「中文输出」单选的取值：简体，或某一种繁体配置。 */
export type ChineseOutputForm = "simplified" | TraditionalChineseVariant;

export interface TraditionalChineseOutputValue {
  traditional_chinese_output: boolean;
  traditional_chinese_variant: TraditionalChineseVariant;
}

export interface TraditionalChineseOutputSectionProps {
  /** 偏好 `traditional_chinese_output`。 */
  value?: boolean;
  /** 偏好 `traditional_chinese_variant`；缺省为 `s2t`。 */
  variant?: TraditionalChineseVariant;
  /** 宿主能按变体转换时列出台湾的两项（`HostCapabilities.traditional_chinese_variants`），否则只有简体和繁体。 */
  variants?: boolean;
  /** The document's input scheme; Cantonese and Zhuyin commit Traditional characters as stored and Stroke commits the character picked as it is, so the choice does not touch them and the row says so. */
  scheme?: InputScheme;
  /** 只交回变了的偏好：选简体时变体不动，下次选回繁体还是它；宿主不认变体时也不动它。 */
  onChange: (patch: Partial<TraditionalChineseOutputValue>) => void;
}

const standardOptions = [
  { value: "simplified", label: "简体" },
  { value: "s2t", label: "繁体" },
] as const satisfies readonly { value: ChineseOutputForm; label: string }[];

const variantOptions = [
  ...standardOptions,
  { value: "s2tw", label: "台湾正体" },
  { value: "s2twp", label: "台湾用词" },
] as const satisfies readonly { value: ChineseOutputForm; label: string }[];

const formDescriptions: Record<ChineseOutputForm, string> = {
  simplified: "按简体中文提交",
  s2t: "将提交的简体中文转换为繁体中文（OpenCC 标准繁体）",
  s2tw: "将提交的简体中文转换为台湾正体字形，如「裡面」「著急」（OpenCC s2tw）",
  s2twp: "转换为台湾正体字形，并换用台湾惯用词，如「軟體」「滑鼠」（OpenCC s2twp）",
};

/** 「中文输出」单选：简体、繁体，宿主支持时再加台湾正体和台湾用词。输入页「输出」组的一行。 */
export function TraditionalChineseOutputSection({
  value,
  variant,
  variants,
  scheme,
  onChange,
}: TraditionalChineseOutputSectionProps) {
  const storedVariant = variant ?? "s2t";
  // 宿主不认变体时它照样按 s2t 转换，所以这里也显示成「繁体」，而不是一个选不中的选项。
  const shownVariant = variants ? storedVariant : "s2t";
  const form: ChineseOutputForm = value ? shownVariant : "simplified";
  const native = scheme === "cantonese" || scheme === "zhuyin";
  const note = native
    ? "。粤拼与注音直接输出繁体，此选项不影响它们"
    : scheme === "stroke"
      ? "。笔画按所选的字原样输出，此选项不影响它"
      : "";
  return (
    <SegmentedRow<ChineseOutputForm>
      title="中文输出"
      description={formDescriptions[form] + note}
      options={variants ? variantOptions : standardOptions}
      value={form}
      onChange={(next) => {
        if (next === "simplified") {
          onChange({ traditional_chinese_output: false });
        } else if (!variants || next === storedVariant) {
          onChange({ traditional_chinese_output: true });
        } else {
          onChange({ traditional_chinese_output: true, traditional_chinese_variant: next });
        }
      }}
    />
  );
}
