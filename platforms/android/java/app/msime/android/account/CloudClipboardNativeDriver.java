package app.msime.android;

import android.content.Context;
import android.os.Build;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 经 JNI 调用共享驱动 `msime_client_cloud_clipboard_e2e`，把输入输出在 JSON 与 {@link CloudClipboardE2e.Step} 之间转换。驱动本身不联网、不落盘，这里也一样。
 */
public final class CloudClipboardNativeDriver implements CloudClipboardE2e.Driver {
    public static final CloudClipboardNativeDriver INSTANCE = new CloudClipboardNativeDriver();

    private CloudClipboardNativeDriver() {}

    /** 本应用里一次云剪贴板操作要用的驱动、密钥串和设备名。 */
    public static CloudClipboardE2e.Local local(Context context) {
        return new CloudClipboardE2e.Local(INSTANCE, CloudClipboardKeystore.forContext(context),
            CloudClipboardE2e.deviceName(Build.MANUFACTURER, Build.MODEL));
    }

    @Override public CloudClipboardE2e.Step start(CloudClipboardE2e.Operation operation, String keystore,
            String deviceName) throws JSONException {
        JSONObject op = new JSONObject().put("op", operation.op());
        switch (operation.op()) {
            case "list" -> op.put("search", operation.search());
            case "add" -> op.put("text", operation.text());
            case "approve", "reject", "remove" -> op.put("device_id", operation.deviceId());
            default -> { }
        }
        JSONObject input = new JSONObject()
            .put("start", op)
            .put("keystore", keystore == null ? JSONObject.NULL : keystore)
            .put("device_name", deviceName == null ? "" : deviceName);
        return step(input);
    }

    @Override public CloudClipboardE2e.Step resume(String state, int status, String body) throws JSONException {
        JSONObject input = new JSONObject()
            .put("resume", new JSONObject(state))
            .put("response", new JSONObject().put("status", status).put("body", body == null ? "" : body));
        return step(input);
    }

    private static CloudClipboardE2e.Step step(JSONObject input) throws JSONException {
        JSONObject root = new JSONObject(NativeClient.cloudClipboardE2e(input.toString()));
        // 外层 ok=false 是输入不合法或系统随机数源不可用，不是服务端的错误；原因不带出去，里面可能有请求内容。
        if (!JsonPolicy.strictTrue(root.opt("ok"))) throw new IllegalStateException("cloud clipboard driver failed");
        JSONObject value = root.getJSONObject("value");
        Object rawKeystore = value.opt("keystore");
        String keystore = rawKeystore == null || rawKeystore == JSONObject.NULL ? null : JsonPolicy.strictString(rawKeystore);
        JSONObject request = value.optJSONObject("request");
        if (request != null) {
            Object rawBody = request.opt("body");
            String body = rawBody == null || rawBody == JSONObject.NULL ? null : JsonPolicy.strictString(rawBody);
            String method = JsonPolicy.strictString(request.opt("method"));
            String path = JsonPolicy.strictString(request.opt("path"));
            JSONObject state = value.optJSONObject("state");
            if (method == null || path == null || state == null || (rawBody != null && rawBody != JSONObject.NULL && body == null))
                throw new IllegalStateException("cloud clipboard driver step");
            return CloudClipboardE2e.Step.request(method, path, body, state.toString(), keystore);
        }
        if (value.has("done")) {
            Object done = value.get("done");
            if (!(done instanceof JSONObject result)) throw new IllegalStateException("cloud clipboard driver step");
            return CloudClipboardE2e.Step.done(result.toString(), keystore);
        }
        JSONObject error = value.optJSONObject("error");
        if (error == null) throw new IllegalStateException("cloud clipboard driver step");
        Integer status = JsonPolicy.strictInteger(error.opt("status"));
        String code = JsonPolicy.strictString(error.opt("code"));
        if (status == null || code == null) throw new IllegalStateException("cloud clipboard driver step");
        return CloudClipboardE2e.Step.error(status, code, keystore);
    }
}
