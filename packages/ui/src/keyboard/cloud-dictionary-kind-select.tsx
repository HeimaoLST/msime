import { ControlledSelect } from "../core/controlled-select";
import * as cloud from "./cloud-panel-style";
import { cloudDictionaryKinds, type CloudDictionaryKind } from "./cloud-dictionary-kind-tabs";

export interface CloudDictionaryKindSelectProps {
  value: CloudDictionaryKind;
  disabled?: boolean;
  onChange: (kind: CloudDictionaryKind) => void;
}

/** Shared kind selector used by cloud dictionary panel toolbars. */
export function CloudDictionaryKindSelect({
  value,
  disabled = false,
  onChange,
}: CloudDictionaryKindSelectProps) {
  return (
    <ControlledSelect
      className={cloud.dictionaryInput}
      aria-label="词库类型"
      value={value}
      onChange={(value) => onChange(value as CloudDictionaryKind)}
      disabled={disabled}
    >
      {cloudDictionaryKinds.map(([kind, label]) => (
        <option key={kind} value={kind}>
          {label}
        </option>
      ))}
    </ControlledSelect>
  );
}
