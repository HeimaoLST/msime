import type { AccountPreferenceSchema, AccountPreferences, SettingsSyncClient } from "@msime/ui";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** 创建账号设置同步的 Tauri 命令桥接；宿主专属文案由组装层补充。 */
export function createSettingsSyncClient(invoke: Invoke): SettingsSyncClient {
  return {
    schema: () => invoke<AccountPreferenceSchema>("account_preferences_schema"),
    load: () => invoke<AccountPreferences>("account_preferences_load"),
    upload: () => invoke<AccountPreferences>("account_preferences_upload"),
    apply: (userId, preferences) =>
      invoke<void>("account_preferences_apply", { userId, preferences }),
  };
}
