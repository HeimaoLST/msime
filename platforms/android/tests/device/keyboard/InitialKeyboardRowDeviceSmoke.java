package app.msime.android.test;

import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONArray;
import org.json.JSONObject;

/** 冷打开合成编辑器时持续观察九键与底行，避免只检查加载结束后的界面。 */
public final class InitialKeyboardRowDeviceSmoke extends DeviceSmoke {
    @Override protected String successDescription() {
        return "nine-key first presentation and editor restart keep the bottom row aligned";
    }

    @Override protected void runChecks() throws Exception {
        File root = getTargetContext().getFilesDir();
        JSONObject options = new JSONObject(new String(Files.readAllBytes(new File(root, "runtime-options.json").toPath()), StandardCharsets.UTF_8));
        File directory = new File(options.getString("preferences_directory")).getCanonicalFile();
        if (!directory.toPath().startsWith(root.getCanonicalFile().toPath())) throw new AssertionError("Preferences escaped test sandbox");
        File preferences = new File(directory, "preferences.json");
        byte[] original = preferences.exists() ? Files.readAllBytes(preferences.toPath()) : null;
        long revision = original == null ? 0 : new JSONObject(new String(original, StandardCharsets.UTF_8)).getLong("revision");
        try {
            JSONObject values = new JSONObject(options.getJSONObject("preferences").toString())
                .put("scheme", "quanpin").put("touch_keyboard_layout", "nine_key")
                .put("ime_mode_scope", "app").put("default_ime_mode", "chinese")
                .put("touch_keyboard_schemes", new JSONObject().put("enabled", new JSONArray().put("nine_key")).put("selected", "nine_key"));
            publish(preferences, new JSONObject().put("format_version", 1).put("revision", revision + 1)
                .put("preferences", values).toString().getBytes(StandardCharsets.UTF_8));
            restartIme();
            openEditor();
            // 先建立一次九键缓存，再复现报告里的编辑器强停与冷打开。
            AccessibilityNodeInfo mode = await(describedPrefix("切换到英文").or(describedPrefix("切换到所选输入方案")));
            if (mode.getContentDescription().toString().startsWith("切换到所选")) tap(key("英"));
            await(key("ABC"));
            for (int attempt = 0; attempt < 5; attempt++) {
                stage = "cold editor first frame " + attempt;
                shellDiscard("am force-stop app.msime.android.firstframe");
                java.util.concurrent.atomic.AtomicBoolean running = new java.util.concurrent.atomic.AtomicBoolean(true);
                java.util.concurrent.atomic.AtomicBoolean observedNineKey = new java.util.concurrent.atomic.AtomicBoolean();
                java.util.concurrent.atomic.AtomicBoolean mismatched = new java.util.concurrent.atomic.AtomicBoolean();
                Thread observer = new Thread(() -> {
                    while (running.get()) {
                        for (AccessibilityWindowInfo window : automation.getWindows()) {
                            AccessibilityNodeInfo rootNode = window.getRoot();
                            if (find(rootNode, key("ABC")) == null) continue;
                            observedNineKey.set(true);
                            if (find(rootNode, described("按键 。")) != null || find(rootNode, described("按键 .")) != null)
                                mismatched.set(true);
                        }
                        SystemClock.sleep(20);
                    }
                }, "synthetic-keyboard-first-frame");
                observer.start();
                try {
                    openEditor();
                    SystemClock.sleep(3000);
                } finally {
                    running.set(false);
                    observer.join();
                }
                if (mismatched.get()) throw new AssertionError("Nine-key grid briefly carried the letter-layout period key");
                if (!observedNineKey.get()) throw new AssertionError("Nine-key first presentation was not observed");
            }
        } finally {
            shellDiscard("am start -W -n app.msime.android/app.msime.android.home.HomeActivity");
            if (original == null) Files.deleteIfExists(preferences.toPath()); else publish(preferences, original);
            restartIme();
        }
    }

    private void openEditor() throws Exception {
        shellDiscard("am start -W -f 0x10008000 -n app.msime.android.firstframe/app.msime.android.test.EditorActivity");
        tap(node -> equalsText("app.msime.android.firstframe", node.getPackageName())
            && equalsText("msime-test-plain", node.getContentDescription()));
    }
}
