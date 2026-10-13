import type { TextareaHTMLAttributes } from "react";

export interface ControlledTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
}

/** Shared controlled textarea primitive used by community and settings forms. */
export function ControlledTextarea({ value, onChange, ...textareaProps }: ControlledTextareaProps) {
  return (
    <textarea {...textareaProps} value={value} onChange={(event) => onChange(event.target.value)} />
  );
}
