import type { SelectHTMLAttributes } from "react";

export interface ControlledSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
}

/** Native select with a controlled string value. */
export function ControlledSelect({ value, onChange, ...selectProps }: ControlledSelectProps) {
  return (
    <select {...selectProps} value={value} onChange={(event) => onChange(event.target.value)} />
  );
}
