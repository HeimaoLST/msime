import * as cloud from "./cloud-panel-style";
import type { CloudClipboardDeviceShape } from "./cloud-response";

/** 设备登记时间，读不出来时原样显示。 */
function registeredAt(value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toLocaleString();
}

function deviceName(device: CloudClipboardDeviceShape): string {
  return device.name || "未命名设备";
}

/** 本机还没有获准时代替条目列表显示：本机的核对码、去哪里允许，以及找不到可以允许的设备时的重置。 */
export function CloudClipboardPendingNotice({
  code,
  busy,
  onRefresh,
  onReset,
}: {
  code: string;
  busy: boolean;
  onRefresh: () => void;
  onReset: () => void;
}) {
  return (
    <section className={cloud.clipboardSection} aria-label="本设备等待允许">
      <p className={cloud.clipboardSectionTitle}>本设备还没有获准使用云剪贴板</p>
      <p className={cloud.clipboardNote}>本设备核对码</p>
      <p className={cloud.clipboardCode} aria-label="本设备核对码">
        {code}
      </p>
      <p className={cloud.clipboardNote}>
        在一台已在使用云剪贴板的设备上打开「云剪贴板」，确认那里显示的核对码与上面完全一致后点「允许」，再回到这里点「刷新」。
      </p>
      <div className={cloud.clipboardActions}>
        <button type="button" className={cloud.clipboardButton} disabled={busy} onClick={onRefresh}>
          刷新
        </button>
        <button type="button" className={cloud.clipboardDelete} disabled={busy} onClick={onReset}>
          重置云剪贴板
        </button>
      </div>
      <p className={cloud.clipboardNote}>
        没有可以用来允许的设备时可以重置：云端的全部条目会被清空，其他设备都需要重新允许。
      </p>
    </section>
  );
}

/** 等待本机允许的设备。允许之前要让用户对照两台设备上的核对码。 */
export function CloudClipboardWaitingDevices({
  devices,
  count,
  busy,
  onApprove,
  onReject,
  onShow,
}: {
  /** 已取到的待允许设备；还没取到时为 `null`，只显示数量。 */
  devices: CloudClipboardDeviceShape[] | null;
  count: number;
  busy: boolean;
  onApprove: (device: CloudClipboardDeviceShape) => void;
  onReject: (device: CloudClipboardDeviceShape) => void;
  onShow: () => void;
}) {
  const total = devices ? devices.length : count;
  return (
    <section className={cloud.clipboardAttention} aria-label="等待允许的设备">
      <p className={cloud.clipboardSectionTitle}>有 {total} 台设备请求使用云剪贴板</p>
      <p className={cloud.clipboardNote}>
        核对两台设备上的核对码一致再允许；不认识的设备请拒绝。允许后，这台设备就能读取和上传云剪贴板。
      </p>
      {devices ? (
        devices.map((device) => (
          <article className={cloud.clipboardDevice} key={device.device_id}>
            <div className={cloud.clipboardDeviceInfo}>
              <span>{deviceName(device)}</span>
              <small>{registeredAt(device.created_at)} 登记</small>
              <span className={cloud.clipboardCode} aria-label={`${deviceName(device)} 的核对码`}>
                {device.code}
              </span>
            </div>
            <div className={cloud.clipboardActions}>
              <button
                type="button"
                className={cloud.clipboardSubmit}
                aria-label={`允许 ${deviceName(device)}`}
                disabled={busy}
                onClick={() => onApprove(device)}
              >
                允许
              </button>
              <button
                type="button"
                className={cloud.clipboardDelete}
                aria-label={`拒绝 ${deviceName(device)}`}
                disabled={busy}
                onClick={() => onReject(device)}
              >
                拒绝
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className={cloud.clipboardActions}>
          <button type="button" className={cloud.clipboardButton} disabled={busy} onClick={onShow}>
            查看设备
          </button>
        </div>
      )}
    </section>
  );
}

/** 已获准的设备，本机以外的可以移除；最后是重置云剪贴板。 */
export function CloudClipboardDeviceList({
  devices,
  busy,
  onRemove,
  onReset,
}: {
  devices: CloudClipboardDeviceShape[];
  busy: boolean;
  onRemove: (device: CloudClipboardDeviceShape) => void;
  onReset: () => void;
}) {
  const approved = devices.filter((device) => device.approved || device.current);
  return (
    <section className={cloud.clipboardSection} aria-label="云剪贴板设备">
      <p className={cloud.clipboardSectionTitle}>已允许的设备</p>
      {approved.map((device) => (
        <article className={cloud.clipboardDevice} key={device.device_id}>
          <div className={cloud.clipboardDeviceInfo}>
            <span>
              {deviceName(device)}
              {device.current ? "（本机）" : ""}
            </span>
            <small>{registeredAt(device.created_at)} 登记</small>
          </div>
          {!device.current && (
            <button
              type="button"
              className={cloud.clipboardDelete}
              aria-label={`移除 ${deviceName(device)}`}
              disabled={busy}
              onClick={() => onRemove(device)}
            >
              移除
            </button>
          )}
        </article>
      ))}
      <p className={cloud.clipboardNote}>
        移除设备或重置云剪贴板都会清空云端条目并更换密钥，其他设备都需要在本设备上重新允许。
      </p>
      <div className={cloud.clipboardActions}>
        <button type="button" className={cloud.clipboardDelete} disabled={busy} onClick={onReset}>
          重置云剪贴板
        </button>
      </div>
    </section>
  );
}
