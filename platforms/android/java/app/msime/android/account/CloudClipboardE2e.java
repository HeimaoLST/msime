package app.msime.android;

import java.util.Objects;

/**
 * 云剪贴板端到端加密在 Android 上的宿主一侧：把共享驱动（`msime_client_cloud_clipboard_e2e`）的每一步请求发出去、把响应交回，并保存驱动交来的密钥串。
 *
 * <p>流程只在 Rust 驱动里有一份（`crates/client-core/src/cloud/clipboard_e2e.rs`，协议见 `docs/cloud-clipboard-e2e.md`）。这里只做宿主的职责：请求一律带账号凭据，经调用方原有的传输层发出；服务端回什么状态码都原样交回驱动，由驱动决定是重取、重传还是报错，连不上服务器才由传输层自己抛出；驱动交来的密钥串与已保存的不同就在发下一个请求之前写进 {@link CloudClipboardKeystore}；驱动报的错以 {@link Failure} 交给调用方，错误码保持驱动给的 `code`。
 *
 * <p>设置页（{@link CloudClipboardApi}）和键盘（{@link BackendAccount}）共用这一个循环，各自只提供传输层和「写入前确认还是同一个登录」的检查。本类不碰 `org.json`、JNI 和 Android 框架，JVM 冒烟可以直接跑它；真正调用 JNI 的驱动在 {@link CloudClipboardNativeDriver}。
 */
public final class CloudClipboardE2e {
    /** 交回驱动的响应正文上限：一页 50 条、每条密文最长 16384 个字符，外加 JSON 外壳；再大就超过 JNI 请求的 2 MiB。 */
    public static final int MAX_RESPONSE_BYTES = 1536 * 1024;
    /** 一次操作最多走几步。驱动自己限定了重取密钥的轮数，这里再兜一道底，坏掉的驱动或服务端不会让循环停不下来。 */
    static final int MAX_STEPS = 32;
    private static final String API = "/v1/users/me/clipboard";
    private static final int MAX_DEVICE_NAME_CHARS = 64;

    private CloudClipboardE2e() {}

    /** 驱动的操作，`op` 与共享驱动的 `Operation` 一一对应；用不到的字段为空字符串。 */
    public record Operation(String op, String search, String text, String deviceId) {
        public static Operation list(String search) { return new Operation("list", TextPolicy.emptyIfNull(search), "", ""); }
        public static Operation add(String text) { return new Operation("add", "", TextPolicy.emptyIfNull(text), ""); }
        public static Operation status() { return new Operation("status", "", "", ""); }
        public static Operation approve(String deviceId) { return device("approve", deviceId); }
        public static Operation reject(String deviceId) { return device("reject", deviceId); }
        public static Operation remove(String deviceId) { return device("remove", deviceId); }
        public static Operation reset() { return new Operation("reset", "", "", ""); }

        private static Operation device(String op, String deviceId) {
            if (!validDeviceId(deviceId)) throw new IllegalArgumentException("invalid clipboard device");
            return new Operation(op, "", "", deviceId);
        }
    }

    /** 驱动一步的三种结果。 */
    public enum Kind { REQUEST, DONE, ERROR }

    /**
     * 驱动的一步。`REQUEST` 带 `method`、`path`、`body`（JSON 文本或 null）和不透明的 `state`（JSON 文本，含本机私钥，只在内存里传递）；`DONE` 带 `result`（JSON 文本）；`ERROR` 带 `errorStatus` 与 `errorCode`。三种都可能带 `keystore`。
     */
    public record Step(Kind kind, String method, String path, String body, String state, String result,
            int errorStatus, String errorCode, String keystore) {
        public static Step request(String method, String path, String body, String state, String keystore) {
            return new Step(Kind.REQUEST, method, path, body, state, null, 0, "", keystore);
        }

        public static Step done(String result, String keystore) {
            return new Step(Kind.DONE, null, null, null, null, result, 0, "", keystore);
        }

        public static Step error(int status, String code, String keystore) {
            return new Step(Kind.ERROR, null, null, null, null, null, status, code, keystore);
        }
    }

    /** 共享驱动。真正的实现经 JNI 调用 Rust（{@link CloudClipboardNativeDriver}）。 */
    public interface Driver {
        Step start(Operation operation, String keystore, String deviceName) throws Exception;

        Step resume(String state, int status, String body) throws Exception;
    }

    /** 本机密钥串的存放处，见 {@link CloudClipboardKeystore}。 */
    public interface Keystore {
        /** 已保存的密钥串；没有或解不开时为 null。 */
        String load() throws Exception;

        /** 保存密钥串。文件里已有另一个设备身份时抛 {@link IdentityConflict}；`guard` 在锁里、写入之前调用，抛出就不写。 */
        void save(String value, Guard guard) throws Exception;

        /** 退出登录时删掉。 */
        void delete() throws Exception;
    }

    /** 写入密钥串之前的检查：开始这次操作的登录还在。 */
    public interface Guard {
        void check() throws Exception;
    }

    /** 发一个带账号凭据的请求，不论状态码都交回；连不上服务器时抛出。 */
    public interface Transport {
        Reply send(String method, String path, String body) throws Exception;
    }

    /** 一次往返的状态码和正文（没有正文时为空字符串）。 */
    public record Reply(int status, String body) {}

    /** 一次操作在本机要用的驱动、密钥串和设备名。 */
    public record Local(Driver driver, Keystore keystore, String deviceName) {}

    /** 文件里已经有另一个设备身份。`stored` 是那份密钥串，调用方改用它重新开始。 */
    public static final class IdentityConflict extends Exception {
        private static final long serialVersionUID = 1L;
        final transient String stored;

        public IdentityConflict(String stored) {
            super("cloud clipboard device identity already stored");
            this.stored = stored;
        }
    }

    /** 驱动报的错：`status` 为 0 表示不是服务端返回的错误（例如本机还在等待批准时上传，`code` 为 `clipboard_device_pending`）。 */
    public static final class Failure extends Exception {
        private static final long serialVersionUID = 1L;
        public final int status;
        public final String code;

        public Failure(int status, String code) {
            super(code == null || code.isEmpty() ? "HTTP " + status : code);
            this.status = status;
            this.code = code == null ? "" : code;
        }
    }

    /**
     * 跑完一个操作，返回驱动的结果（JSON 文本）。
     *
     * <p>第一次使用时驱动会生成新的设备身份，并在第一个请求之前交来；如果另一个进程恰好也在这时生成并先写进了自己的身份，保存会被拒绝，这里改用文件里的那个身份从头再来一次——那时还没有发出任何请求，服务端只会看到一台设备。之后的任何一步都不会再换身份，再被拒绝就说明这次操作期间退出又登录过，按失败处理。
     *
     * @throws Failure 驱动报的错
     * @throws Exception 传输层、密钥串存储或 `guard` 抛出的原样交出
     */
    public static String run(Local local, Operation operation, Transport transport, Guard guard) throws Exception {
        Objects.requireNonNull(operation, "operation");
        String saved = local.keystore().load();
        Step step = local.driver().start(operation, saved, local.deviceName());
        boolean sent = false;
        boolean restarted = false;
        for (int count = 0; count < MAX_STEPS; count++) {
            String current = step.keystore();
            if (current != null && !current.isEmpty() && !current.equals(saved)) {
                try {
                    local.keystore().save(current, guard);
                    saved = current;
                } catch (IdentityConflict conflict) {
                    if (sent || restarted || conflict.stored == null) throw new Failure(0, "clipboard_keystore_conflict");
                    restarted = true;
                    saved = conflict.stored;
                    step = local.driver().start(operation, saved, local.deviceName());
                    continue;
                }
            }
            switch (step.kind()) {
                case DONE -> {
                    if (step.result() == null) throw new Failure(0, "invalid_response");
                    return step.result();
                }
                case ERROR -> throw new Failure(Math.max(0, step.errorStatus()), step.errorCode());
                case REQUEST -> {
                    if (!validRequest(step.method(), step.path()) || step.state() == null)
                        throw new Failure(0, "invalid_state");
                    Reply reply = transport.send(step.method(), step.path(), step.body());
                    sent = true;
                    String body = reply.body() == null ? "" : reply.body();
                    if (TextPolicy.utf8Length(body) > MAX_RESPONSE_BYTES) throw new Failure(0, "invalid_response");
                    step = local.driver().resume(step.state(), reply.status(), body);
                }
            }
        }
        throw new Failure(0, "invalid_response");
    }

    /** 驱动只会请求云剪贴板自己的接口；别的方法或路径一律当作驱动出错，不发出去。 */
    static boolean validRequest(String method, String path) {
        if (!("GET".equals(method) || "PUT".equals(method) || "POST".equals(method) || "DELETE".equals(method)))
            return false;
        return path != null && (path.equals(API) || path.startsWith(API + "/") || path.startsWith(API + "?"))
            && path.length() <= 512 && !path.contains("..") && !path.contains("\\") && !TextPolicy.hasControl(path);
    }

    /** 设备编号：公钥 SHA-256 的前 16 字节，32 位小写十六进制。 */
    public static boolean validDeviceId(String deviceId) {
        return TextPolicy.isLowerHex(deviceId, 32);
    }

    /**
     * 登记给服务端、在其他设备的设备列表和条目上显示的名字：厂商加型号，例如「Google Pixel 8」；型号本身已经以厂商开头时只用型号（「Xiaomi 23127PN0CC」不重复）。
     *
     * <p>不读系统设置里用户自己起的设备名：那常常带着人名，而设备名是服务端看得到的元数据。去掉控制字符，最多 64 个字符；都读不到时是「Android 设备」。
     */
    public static String deviceName(String manufacturer, String model) {
        String maker = TextPolicy.trimmed(TextPolicy.removeControls(TextPolicy.emptyIfNull(manufacturer)));
        String device = TextPolicy.trimmed(TextPolicy.removeControls(TextPolicy.emptyIfNull(model)));
        if (!maker.isEmpty() && !"unknown".equalsIgnoreCase(maker)) {
            maker = Character.toUpperCase(maker.charAt(0)) + maker.substring(1);
            if (!TextPolicy.lowercase(device).startsWith(TextPolicy.lowercase(maker))) {
                device = device.isEmpty() ? maker : maker + " " + device;
            }
        }
        String name = TextPolicy.trimmed(TextPolicy.clipCodePoints(device, MAX_DEVICE_NAME_CHARS));
        return name.isEmpty() ? "Android 设备" : name;
    }
}
