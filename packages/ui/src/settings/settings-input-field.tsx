import type { InputHTMLAttributes, ReactNode } from "react";
import { LabeledInputField } from "../core/labeled-input-field";
import * as settings from "./settings-style";

export interface SettingsInputFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "aria-label" | "className"
> {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  className?: string;
  onChange: (value: string) => void;
}

/** Shared stacked text input used by settings manager forms. */
export function SettingsInputField({
  label,
  ariaLabel,
  value,
  className = settings.fieldInput,
  onChange,
  ...inputProps
}: SettingsInputFieldProps) {
  return (
    <LabeledInputField
      {...inputProps}
      label={label}
      ariaLabel={ariaLabel}
      value={value}
      className={className}
      labelClassName={settings.field}
      onChange={onChange}
    />
  );
}
