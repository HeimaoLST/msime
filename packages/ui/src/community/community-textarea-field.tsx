import type { ReactNode } from "react";
import { ControlledTextarea } from "../core/controlled-textarea";
import { CommunityField } from "./community-field";
import * as style from "./community-style";

export interface CommunityTextareaFieldProps {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** Shared styled textarea field used by community forms. */
export function CommunityTextareaField({
  label,
  ariaLabel,
  value,
  rows,
  maxLength,
  disabled,
  placeholder,
  onChange,
}: CommunityTextareaFieldProps) {
  return (
    <CommunityField label={label}>
      <ControlledTextarea
        className={style.textArea}
        aria-label={ariaLabel}
        maxLength={maxLength}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
      />
    </CommunityField>
  );
}
