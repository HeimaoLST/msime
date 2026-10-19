import type { KeyboardEvent } from "react";
import { clipboardTooltip } from "./emoji-panel-helpers";
import { clipboardRow, clipboardSideButton } from "./emoji-panel-style";

export interface EmojiClipboardEntriesProps {
  items: readonly string[];
  busy: boolean;
  canCopy: boolean;
  onCopy: (text: string) => void;
  onItemKeyDown: (event: KeyboardEvent<HTMLButtonElement>, text: string) => void;
  onPaste?: (text: string) => void;
  onRemove?: (text: string) => void;
}

/** 剪贴板记录的受控视图，导航标记和原始键盘事件交给面板状态处理。 */
export function EmojiClipboardEntries({
  items,
  busy,
  canCopy,
  onCopy,
  onItemKeyDown,
  onPaste,
  onRemove,
}: EmojiClipboardEntriesProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      {items.map((item) => (
        <div className="flex items-stretch gap-1.5" data-clipboard-row="" key={item}>
          <button
            type="button"
            className={clipboardRow}
            data-clipboard-item=""
            data-emoji-navigation-item
            aria-keyshortcuts={
              [canCopy ? "Control+c" : "", onRemove ? "Delete" : ""].filter(Boolean).join(" ") ||
              undefined
            }
            onKeyDown={(event) => onItemKeyDown(event, item)}
            disabled={busy}
            title={clipboardTooltip(item)}
            onClick={() => void onCopy(item)}
          >
            {item.replace(/[\r\n\t]/g, " ")}
          </button>
          {onPaste && (
            <button
              type="button"
              className={clipboardSideButton}
              disabled={busy}
              aria-label="粘贴此条记录到原应用"
              onClick={() => void onPaste(item)}
            >
              粘贴
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className={clipboardSideButton}
              disabled={busy}
              aria-label="删除此条记录"
              onClick={() => void onRemove(item)}
            >
              删除
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
