import app.msime.android.SkinHintFilePolicy;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SkinHintFilePolicySmoke {
    private static void check(boolean condition) {
        if (!condition) throw new AssertionError();
    }

    public static void main(String[] args) throws Exception {
        Path root = Files.createTempDirectory("msime-skin-hint-");
        try {
            Path source = root.resolve("source.json");
            Files.writeString(source, "{\"touch_toolbar\":{}}\n");
            check(SkinHintFilePolicy.readable(source.toFile()));
            Path hardlink = root.resolve("keyboard-skin-hint.json");
            Files.createLink(hardlink, source);
            check(!SkinHintFilePolicy.readable(hardlink.toFile()));
            Files.delete(hardlink);
            Path symlink = root.resolve("keyboard-skin-hint-link.json");
            Files.createSymbolicLink(symlink, source);
            check(!SkinHintFilePolicy.readable(symlink.toFile()));
            System.out.println("Android skin hint file policy: private single-link reads passed");
        } finally {
            try (java.util.stream.Stream<Path> paths = Files.walk(root)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try { Files.deleteIfExists(path); }
                    catch (Exception error) { throw new IllegalStateException(error); }
                });
            }
        }
    }
}
