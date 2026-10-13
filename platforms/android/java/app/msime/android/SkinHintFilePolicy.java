package app.msime.android;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.LinkOption;

/** Bounds and ownership checks for the keyboard's first-frame skin hint. */
public final class SkinHintFilePolicy {
    public static final int MAX_BYTES = 1_000_000;

    private SkinHintFilePolicy() {}

    public static boolean readable(File file) {
        return file != null
            && Files.isRegularFile(file.toPath(), LinkOption.NOFOLLOW_LINKS)
            && SafePaths.isSingleLink(file.toPath())
            && file.length() <= MAX_BYTES;
    }
}
