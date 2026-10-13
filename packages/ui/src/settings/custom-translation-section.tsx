import { SettingsGroupNote } from "./settings-group-note";
import { SettingsWarning } from "./settings-warning";
import type { ReactNode } from "react";
import { SecretSettingRow } from "./secret-setting-row";
import { EndpointSettingRow } from "./endpoint-setting-row";
import { SettingsGroupBlock } from "./settings-group-block";
import { SettingsRowStack } from "./settings-row-stack";

export interface CustomTranslationSectionProps {
  available: boolean;
  endpoint: string;
  apiKey: string;
  endpointIssue?: string;
  /** API Key 的问题，例如 DeepL 官方地址没有填密钥。 */
  apiKeyIssue?: string;
  onEndpointChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  children?: ReactNode;
}

/** 自定义服务的说明：DeepL 官方地址也走这里，因此要说明候选词会发到 DeepL。 */
const customTranslationNote =
  "填写自建的 DeepLX 兼容 HTTPS 服务；也可以填 DeepL 官方 API 地址（https://api-free.deepl.com/v2/translate 或 https://api.deepl.com/v2/translate），并在 API Key 里填 DeepL 的 Auth Key。使用 DeepL 时，需要翻译的候选词会发送到 DeepL，按 DeepL 的数据政策处理。";

/** 用户自行管理的翻译接口（自建的 DeepLX 兼容服务，或用自己密钥的 DeepL 官方 API）的设置，在它是所选翻译服务时显示；服务本身在「翻译服务」中选择。 */
export function CustomTranslationSection({
  available,
  endpoint,
  apiKey,
  endpointIssue,
  apiKeyIssue,
  onEndpointChange,
  onApiKeyChange,
  children,
}: CustomTranslationSectionProps) {
  return (
    <SettingsRowStack role="group" aria-label="自定义翻译服务">
      <SettingsGroupNote>{customTranslationNote}</SettingsGroupNote>
      <EndpointSettingRow
        title="翻译 Endpoint"
        inputLabel="自定义翻译 Endpoint"
        value={endpoint}
        disabled={!available}
        onChange={onEndpointChange}
        placeholder="https://example.com/translate"
      />
      {available && endpointIssue && (
        <SettingsGroupBlock>
          <SettingsWarning>{endpointIssue}</SettingsWarning>
        </SettingsGroupBlock>
      )}
      <SecretSettingRow
        title="API Key"
        label="自定义翻译 API Key"
        value={apiKey}
        disabled={!available}
        onChange={onApiKeyChange}
      />
      {available && apiKeyIssue && (
        <SettingsGroupBlock>
          <SettingsWarning>{apiKeyIssue}</SettingsWarning>
        </SettingsGroupBlock>
      )}
      {children && <SettingsGroupBlock>{children}</SettingsGroupBlock>}
    </SettingsRowStack>
  );
}
