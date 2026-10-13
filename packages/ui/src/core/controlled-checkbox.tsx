import type { InputHTMLAttributes } from "react";

export interface ControlledCheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "checked" | "onChange"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Native checkbox with a controlled boolean value. */
export function ControlledCheckbox({ checked, onChange, ...inputProps }: ControlledCheckboxProps) {
  return (
    <input
      {...inputProps}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
