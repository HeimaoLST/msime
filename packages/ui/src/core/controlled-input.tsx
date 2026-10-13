import type { InputHTMLAttributes } from "react";

export interface ControlledInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
}

/** Native input with a controlled string value. */
export function ControlledInput({ value, onChange, ...inputProps }: ControlledInputProps) {
  return <input {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} />;
}
