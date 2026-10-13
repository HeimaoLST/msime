import { AccountInputField } from "./account-input-field";
import { AccountNicknameField } from "./account-nickname-field";
import * as account from "./account-style";

export const accountNicknameHelpText = "昵称会显示在社区作品中，已发布的作品也会同步更新。";
const invalidNameText = "昵称最多 64 个字符，请勿使用换行或控制字符。";
const emptyNameText = "取一个喜欢的名字，让大家记住你。";

/** Shared nickname input and guidance for the account profile presentations. */
export function AccountNicknameEditor({
  variant,
  value,
  normalizedName,
  validName,
  disabled,
  onChange,
}: {
  variant: "mobile" | "sheet" | "desktop";
  value: string;
  normalizedName: string;
  validName: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const count = [...normalizedName].length;
  const guidance = normalizedName
    ? validName
      ? accountNicknameHelpText
      : invalidNameText
    : emptyNameText;

  if (variant === "sheet")
    return (
      <>
        <AccountInputField
          label={<span className="sr-only">社区昵称</span>}
          ariaLabel="编辑社区昵称"
          className={account.sheetInput}
          maxLength={64}
          value={value}
          disabled={disabled}
          data-sheet-autofocus=""
          onChange={onChange}
        />
        <p className={!validName && normalizedName ? account.sheetHintError : account.sheetHint}>
          {normalizedName && validName ? `${count}/64` : guidance}
        </p>
      </>
    );

  return (
    <>
      <AccountNicknameField
        value={value}
        disabled={disabled}
        ariaLabel="编辑社区昵称"
        onChange={onChange}
      />
      {variant === "mobile" ? (
        <>
          <p className={`account-muted${!validName && normalizedName ? " error" : ""}`}>
            {guidance}
          </p>
          <p className={account.muted}>{count}/64</p>
        </>
      ) : (
        <p className={account.muted}>{accountNicknameHelpText}</p>
      )}
    </>
  );
}
