import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { EmojiPanel, StatusMessage, type EmojiPanelClient } from "@msime/ui";

/** 独立窗口和设置页内的表情、剪贴板面板共用桌面粘贴能力与关闭装配。 */
export function DesktopEmojiPanel({
  theme,
  initialPage = "home",
  client: providedClient,
  close,
}: {
  theme: "dark" | "light";
  initialPage?: "home" | "clipboard";
  client: EmojiPanelClient;
  close?: () => Promise<void>;
}) {
  const [emojiClient, setEmojiClient] = useState<EmojiPanelClient | null>(null);
  const panelLabel = initialPage === "clipboard" ? "clipboard-panel" : "emoji-panel";
  useEffect(() => {
    let active = true;
    const capability = isTauri()
      ? invoke<boolean>("supports_clipboard_paste").catch(() => false)
      : Promise.resolve(false);
    void capability.then((supported) => {
      if (!active) return;
      const baseClient = providedClient;
      const closePanel = close ?? (() => invoke("close_panel", { label: panelLabel }));
      setEmojiClient(
        supported
          ? {
              ...baseClient,
              close: closePanel,
              clipboard: baseClient.clipboard
                ? {
                    ...baseClient.clipboard,
                    paste: (text) => invoke<void>("paste_clipboard_text", { text }),
                  }
                : undefined,
            }
          : { ...baseClient, close: closePanel },
      );
    });
    return () => {
      active = false;
    };
  }, [close, panelLabel, providedClient]);
  return emojiClient ? (
    <EmojiPanel client={emojiClient} theme={theme} initialPage={initialPage} />
  ) : (
    <StatusMessage role="status">正在连接面板…</StatusMessage>
  );
}
