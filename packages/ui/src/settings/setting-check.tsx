import type { ReactNode } from "react";
import { ControlledCheckbox } from "../core/controlled-checkbox";

export interface SettingCheckProps {
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (checked: boolean) => void;
}

/** Shared compact checkbox row for option lists inside a settings section. */
export function SettingCheck({ label, checked, disabled, ariaLabel, onChange }: SettingCheckProps) {
  return (
    <label className="check-option">
      <ControlledCheckbox
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}
