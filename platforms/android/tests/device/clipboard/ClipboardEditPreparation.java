package app.msime.android.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.os.Bundle;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONArray;
import org.json.JSONObject;

/** 宿主 UID 只负责准备和核验存储，页面操作在另一轮外部 UID 的 instrumentation 中执行。 */
public class ClipboardEditPreparation extends Instrumentation {
    private Bundle arguments;

    @Override public void onCreate(Bundle args) {
        super.onCreate(args);
        arguments = args == null ? new Bundle() : args;
        start();
    }

    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            File root = getTargetContext().getFilesDir();
            File backup = new File(getTargetContext().getCacheDir(), "clipboard-edit-test-backup");
            if ("true".equals(arguments.getString("restore"))) {
                JSONObject saved = read(new File(backup, "manifest.json"));
                restore(new File(saved.getString("preferences")), backup, "preferences", saved);
                restore(new File(root, "MSIME/clipboard_history.json"), backup, "history", saved);
                for (File file : backup.listFiles()) Files.delete(file.toPath());
                Files.delete(backup.toPath());
            } else if ("true".equals(arguments.getString("inspect"))) {
                JSONArray entries = new JSONArray(new String(Files.readAllBytes(
                    new File(root, "MSIME/clipboard_history.json").toPath()), StandardCharsets.UTF_8));
                if (entries.length() != 2) throw new AssertionError("History entry count changed");
                verify(entries.getJSONObject(0), ClipboardEditDeviceSmoke.REPLACEMENT, 1700000000002L, true);
                verify(entries.getJSONObject(1), ClipboardEditDeviceSmoke.SHORT, 1700000000001L, false);
            } else {
                if (backup.exists()) throw new AssertionError("Unrestored clipboard test backup exists");
                JSONObject options = read(new File(root, "runtime-options.json"));
                File preferences = new File(options.getString("preferences_directory"), "preferences.json");
                if (!backup.mkdir()) throw new AssertionError("Clipboard test backup creation failed");
                JSONObject saved = new JSONObject().put("preferences", preferences.getAbsolutePath());
                save(preferences, backup, "preferences", saved);
                save(new File(root, "MSIME/clipboard_history.json"), backup, "history", saved);
                write(new File(backup, "manifest.json"), saved.toString().getBytes(StandardCharsets.UTF_8));
                JSONObject document = preferences.isFile() ? read(preferences) : new JSONObject()
                    .put("format_version", 1).put("revision", 0).put("preferences", options.getJSONObject("preferences"));
                document.put("revision", document.getLong("revision") + 1);
                JSONObject preferenceDocument = document.getJSONObject("preferences");
                preferenceDocument.put("clipboard_history", true);
                JSONObject toolbar = preferenceDocument.optJSONObject("touch_toolbar");
                if (toolbar == null) toolbar = new JSONObject();
                toolbar.put("clipboard", true);
                preferenceDocument.put("touch_toolbar", toolbar);
                write(preferences, document.toString().getBytes(StandardCharsets.UTF_8));
                JSONArray entries = new JSONArray()
                    .put(entry(ClipboardEditDeviceSmoke.ORIGINAL, 1700000000002L, true))
                    .put(entry(ClipboardEditDeviceSmoke.SHORT, 1700000000001L, false));
                write(new File(root, "MSIME/clipboard_history.json"), entries.toString().getBytes(StandardCharsets.UTF_8));
            }
            result.putString("stream", "MSIME_CLIPBOARD_PREPARATION_PASSED\n");
            finish(Activity.RESULT_OK, result);
        } catch (Exception | AssertionError error) {
            result.putString("stream", "MSIME_CLIPBOARD_PREPARATION_FAILED: " + error.getClass().getSimpleName()
                + (error instanceof AssertionError ? " " + error.getMessage() : "") + "\n");
            finish(Activity.RESULT_CANCELED, result);
        }
    }

    private static JSONObject read(File file) throws Exception {
        return new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
    }

    private static JSONObject entry(String text, long timestamp, boolean pinned) throws Exception {
        return new JSONObject().put("text", text).put("timestampMs", timestamp).put("pinned", pinned);
    }

    private static void verify(JSONObject entry, String text, long timestamp, boolean pinned) throws Exception {
        if (!text.equals(entry.getString("text")) || timestamp != entry.getLong("timestampMs")
                || pinned != entry.getBoolean("pinned")) throw new AssertionError("Synthetic entry metadata changed");
    }

    private static void save(File file, File backup, String name, JSONObject saved) throws Exception {
        saved.put(name + "_present", file.isFile());
        if (file.isFile()) write(new File(backup, name), Files.readAllBytes(file.toPath()));
    }

    private static void restore(File file, File backup, String name, JSONObject saved) throws Exception {
        if (saved.getBoolean(name + "_present")) write(file, Files.readAllBytes(new File(backup, name).toPath()));
        else Files.deleteIfExists(file.toPath());
    }

    private static void write(File file, byte[] bytes) throws Exception {
        AtomicFile target = new AtomicFile(file);
        FileOutputStream output = target.startWrite();
        try {
            output.write(bytes);
            target.finishWrite(output);
        } catch (Exception error) {
            target.failWrite(output);
            throw error;
        }
    }
}
