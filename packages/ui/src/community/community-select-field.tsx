import type { ReactNode } from "react";
import { ControlledSelect } from "../core/controlled-select";
import { CommunityField } from "./community-field";
import * as style from "./community-style";

export interface CommunitySelectFieldProps {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  disabled?: boolean;
  children: ReactNode;
  onChange: (value: string) => void;
}

/** Shared styled select field used by community forms. */
export function CommunitySelectField({
  label,
  ariaLabel,
  value,
  disabled,
  children,
  onChange,
}: CommunitySelectFieldProps) {
  return (
    <CommunityField label={label}>
      <ControlledSelect
        className={style.fieldControl}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={onChange}
      >
        {children}
      </ControlledSelect>
    </CommunityField>
  );
}
