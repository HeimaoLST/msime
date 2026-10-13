import type { InputHTMLAttributes, ReactNode } from "react";
import { ControlledInput } from "../core/controlled-input";
import { CommunityField } from "./community-field";
import * as style from "./community-style";

export interface CommunityInputFieldProps {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** Shared styled text input field used by community forms. */
export function CommunityInputField({
  label,
  ariaLabel,
  value,
  type,
  maxLength,
  disabled,
  placeholder,
  onChange,
}: CommunityInputFieldProps) {
  return (
    <CommunityField label={label}>
      <ControlledInput
        className={style.fieldControl}
        aria-label={ariaLabel}
        type={type}
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
      />
    </CommunityField>
  );
}
