import { McpConnectSection } from "../mcp-connect";
import { useSettingsForm } from "../settings-form-context";
import { DiagnosticLogsSection } from "../diagnostic-logs-section";
import { DataDirectorySection } from "../data-directory-section";
import { InputMethodServiceSection } from "../input-method-service-section";
import { UninstallSection } from "../uninstall-section";
import { createAboutSettingsActions } from "../about-settings-actions";
import { SettingsPageFieldset } from "../settings-page-fieldset";

/** 维护与诊断页：只放输入法服务、诊断日志、数据目录和卸载等维护操作。 */
export function DeveloperSettingsPage() {
  const {
    client,
    linuxPlatform,
    windowsPlatform,
    macosPlatform,
    showRestartInputMethod,
    showInstallInputSource,
    setDraft,
    busy,
    setError,
    dataDirectory,
    dataDirectoryBusy,
    dataDirectoryResult,
    chooseDataDirectory,
    diagnosticLog,
    page,
    checkForUpdate,
    confirmUninstall,
    selectPage,
    removeUserDataOnUninstall,
    setRemoveUserDataOnUninstall,
    uninstallConfirmation,
    uninstallBusy,
    uninstallResult,
    requestUninstall,
    cancelUninstall,
  } = useSettingsForm();
  const { onChooseDataDirectory, onDiagnosticLogChange, onConfirmUninstall } =
    createAboutSettingsActions({
      checkForUpdate,
      chooseDataDirectory,
      confirmUninstall,
      selectPage,
      setDraft,
    });
  return (
    <SettingsPageFieldset disabled={busy} hidden={page !== "developer"} ariaLabel="维护与诊断">
      <InputMethodServiceSection
        visible={Boolean(showRestartInputMethod)}
        macos={macosPlatform}
        linux={linuxPlatform}
        restartInputMethod={client.restartInputMethod}
        installInputSource={showInstallInputSource ? client.installInputSource : undefined}
      />
      <DiagnosticLogsSection
        visible={!client.host || linuxPlatform || windowsPlatform || macosPlatform}
        linux={linuxPlatform}
        macos={macosPlatform}
        windows={windowsPlatform || !client.host}
        values={diagnosticLog}
        openDirectory={client.openDiagnosticLogDirectory}
        onChange={onDiagnosticLogChange}
        onError={setError}
      />
      <DataDirectorySection
        visible={Boolean((macosPlatform || linuxPlatform) && client.dataDirectory)}
        linux={linuxPlatform}
        dataDirectory={dataDirectory}
        busy={dataDirectoryBusy}
        result={dataDirectoryResult}
        onChoose={onChooseDataDirectory}
      />
      {macosPlatform && (
        <UninstallSection
          uninstallInputSource={client.uninstallInputSource}
          removeUserData={removeUserDataOnUninstall}
          uninstallBusy={uninstallBusy}
          uninstallConfirmation={uninstallConfirmation}
          uninstallResult={uninstallResult}
          onRemoveUserDataChange={setRemoveUserDataOnUninstall}
          onRequestUninstall={requestUninstall}
          onConfirmUninstall={onConfirmUninstall}
          onCancelUninstall={cancelUninstall}
        />
      )}
    </SettingsPageFieldset>
  );
}

/** 桌面和触屏宿主共用 MCP 连接内容。 */
function McpSettingsContent() {
  const { client } = useSettingsForm();
  if (!client.mcpServerStatus) return null;
  return (
    <McpConnectSection
      status={client.mcpServerStatus}
      install={client.installMcpClient}
      copyText={client.copyText}
    />
  );
}

/** `mcp` 是独立的 AI 助手设置页，桌面和触屏宿主都从设置导航进入。 */
export function McpSettingsPage() {
  const { client, busy, page } = useSettingsForm();
  if (!client.mcpServerStatus) return null;
  return (
    <SettingsPageFieldset disabled={busy} hidden={page !== "mcp"} ariaLabel="AI 助手">
      <McpSettingsContent />
    </SettingsPageFieldset>
  );
}
