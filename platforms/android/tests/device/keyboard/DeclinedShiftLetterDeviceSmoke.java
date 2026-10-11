package app.msime.android.test;

import android.os.ParcelFileDescriptor;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;

/** 关闭辅助码后，完整拼音后的 Shift 字母由宿主接续上屏。 */
public final class DeclinedShiftLetterDeviceSmoke extends DeviceSmoke {
    @Override protected String successDescription() {
        return "disabled helpcode commits the first candidate before a shifted letter";
    }

    @Override protected void runChecks() throws Exception {
        File root = getTargetContext().getFilesDir();
        JSONObject options = new JSONObject(new String(
            Files.readAllBytes(new File(root, "runtime-options.json").toPath()), StandardCharsets.UTF_8));
        File directory = new File(options.getString("preferences_directory")).getCanonicalFile();
        File preferences = new File(directory, "preferences.json");
        byte[] original = preferences.exists() ? Files.readAllBytes(preferences.toPath()) : null;
        long revision = original == null ? 0
            : new JSONObject(new String(original, StandardCharsets.UTF_8)).getLong("revision");
        JSONObject values = new JSONObject(options.getJSONObject("preferences").toString());
        values.put("scheme", "quanpin").put("touch_keyboard_layout", "twenty_six_key")
            .put("quanpin_helpcode", new JSONObject().put("enabled", false).put("schema", "ziranma"));
        try {
            stage = "disable full-pinyin helpcode";
            JSONObject snapshot = new JSONObject().put("format_version", 1)
                .put("revision", revision + 1).put("preferences", values);
            publish(preferences, snapshot.toString().getBytes(StandardCharsets.UTF_8));
            shell("ime disable app.msime.android/.MSIMEInputService");
            shell("ime enable app.msime.android/.MSIMEInputService");
            shell("ime set app.msime.android/.MSIMEInputService");
            shell("am start -W -f 0x10008000 -n app.msime.android.test/app.msime.android.test.EditorActivity");
            tap(field("msime-test-plain"));
            stage = "complete pinyin composition";
            for (String letter : new String[] {"n", "i", "h", "a", "o"}) tap(key(letter));
            await(field("msime-test-plain").and(node -> equalsText("nihao", node.getText())));
            stage = "declined shifted letter";
            tap(key("⇧"));
            await(key("O"));
            tap(key("O"));
            await(field("msime-test-plain").and(node -> equalsText("你好O", node.getText())));
        } finally {
            shell("am start -W -n app.msime.android/app.msime.android.home.HomeActivity");
            if (original == null) Files.deleteIfExists(preferences.toPath());
            else publish(preferences, original);
        }
    }

    private void shell(String command) throws Exception {
        try (var input = new ParcelFileDescriptor.AutoCloseInputStream(automation.executeShellCommand(command))) {
            byte[] buffer = new byte[1024];
            while (input.read(buffer) != -1) { }
        }
    }

    private void publish(File file, byte[] contents) throws Exception {
        AtomicFile target = new AtomicFile(file);
        FileOutputStream output = target.startWrite();
        try { output.write(contents); target.finishWrite(output); }
        catch (Exception error) { target.failWrite(output); throw error; }
    }
}
