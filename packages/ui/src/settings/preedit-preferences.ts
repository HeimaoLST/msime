export type CandidatePreeditStyle = "pinyin" | "empty";
export type PreeditStyle = "raw" | CandidatePreeditStyle;
export type TsfPreeditStyle = PreeditStyle;

export type PreeditPreferences = {
  /** 双拼预编辑是否保留原始按键；缺省为保留，设置入口由宿主能力决定。 */
  shuangpin_preedit_uses_raw?: boolean;
  /** 行内（宿主绘制）预编辑；Linux 通过 `ClientEngine.preedit_style()` 应用。 */
  tsf_preedit_style?: TsfPreeditStyle;
  candidate_preedit_style?: CandidatePreeditStyle;
};
