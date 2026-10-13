package app.msime.android.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.os.Bundle;
import app.msime.android.CloudClipboardE2e;
import app.msime.android.CloudClipboardKeystore;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** 在设备上验证云剪贴板密钥串：AndroidKeyStore 加密落盘、应用私有目录里的原子替换、一个身份、删除。 */
public final class CloudClipboardKeystoreDeviceSmoke extends Instrumentation {
    private static final String SECRET_MARKER = "Fixture" + "K".repeat(36);
    private static final String IDENTITY = "v1." + SECRET_MARKER;
    private static final String KEYED = IDENTITY + "." + "0".repeat(32) + "." + "C".repeat(43);
    private static final String OTHER = "v1." + "B".repeat(43);

    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        start();
    }

    @Override public void onStart() {
        Bundle result = new Bundle();
        CloudClipboardKeystore keystore = CloudClipboardKeystore.forContext(getContext());
        try {
            keystore.delete();
            if (keystore.load() != null) throw new AssertionError("empty");
            keystore.save(IDENTITY, null);
            if (!IDENTITY.equals(keystore.load())) throw new AssertionError("roundtrip");
            File file = new File(getContext().getFilesDir(), CloudClipboardKeystore.FILE_NAME);
            byte[] raw = Files.readAllBytes(file.toPath());
            if (new String(raw, StandardCharsets.ISO_8859_1).contains(SECRET_MARKER)) throw new AssertionError("plaintext");
            keystore.save(KEYED, null);
            if (!KEYED.equals(CloudClipboardKeystore.forContext(getContext()).load())) throw new AssertionError("replace");
            boolean refused = false;
            try {
                keystore.save(OTHER, null);
            } catch (CloudClipboardE2e.IdentityConflict expected) {
                refused = true;
            }
            if (!refused || !KEYED.equals(keystore.load())) throw new AssertionError("identity");
            String[] names = getContext().getFilesDir().list();
            if (names != null) {
                for (String name : names) {
                    if (name.startsWith(CloudClipboardKeystore.FILE_NAME + ".") && name.endsWith(".tmp"))
                        throw new AssertionError("leftover");
                }
            }
            keystore.delete();
            if (keystore.load() != null || file.exists()) throw new AssertionError("delete");
            result.putString("stream",
                "MSIME_DEVICE_SMOKE_PASSED: cloud clipboard keystore encrypted roundtrip, plaintext exclusion, single identity and delete\n");
            finish(Activity.RESULT_OK, result);
        } catch (Exception | AssertionError error) {
            result.putString("stream", "MSIME_DEVICE_SMOKE_FAILED: cloud clipboard keystore ("
                + error.getClass().getSimpleName() + ": " + error.getMessage() + ")\n");
            finish(Activity.RESULT_CANCELED, result);
        } finally {
            try {
                keystore.delete();
            } catch (Exception ignored) {
                // The fixed failure line above remains free of keystore contents.
            }
        }
    }
}
