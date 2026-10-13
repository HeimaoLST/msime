import app.msime.android.ClipboardImageCache;
import app.msime.android.ClipboardImagePolicy;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

/** #6781：剪贴板图片的类型选择、输入框是否收得下、缓存副本的大小上限与清理。 */
public final class ClipboardImagePolicySmoke {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) throws IOException {
        // 剪贴板描述里取第一个具体图片类型，跳过文字、通配符和空值。
        check("image/png".equals(ClipboardImagePolicy.imageMimeType(new String[] {"text/uri-list", "image/png"})),
            "the first concrete image type is the one sent");
        check("image/jpeg".equals(ClipboardImagePolicy.imageMimeType(new String[] {"image/*", " IMAGE/JPEG "})),
            "wildcards are skipped and the type is normalized");
        check("image/webp".equals(ClipboardImagePolicy.imageMimeType(new String[] {"image/webp; q=1"})),
            "parameters are dropped");
        check(ClipboardImagePolicy.imageMimeType(new String[] {"text/plain", "text/html"}) == null, "text is not an image");
        check(ClipboardImagePolicy.imageMimeType(new String[] {null, "", "image/"}) == null, "no usable type");
        check(ClipboardImagePolicy.imageMimeType(null) == null, "no description, no image");

        // 输入框声明的类型：同 ClipDescription.compareMimeTypes，没声明就是不收。
        check(ClipboardImagePolicy.accepts(new String[] {"image/*"}, "image/png"), "image/* takes any image");
        check(ClipboardImagePolicy.accepts(new String[] {"*/*"}, "image/gif"), "*/* takes anything");
        check(ClipboardImagePolicy.accepts(new String[] {"image/gif", "IMAGE/PNG"}, "image/png"), "exact types match case-insensitively");
        check(!ClipboardImagePolicy.accepts(new String[] {"image/gif"}, "image/png"), "a GIF-only editor does not take a PNG");
        check(!ClipboardImagePolicy.accepts(new String[] {"video/*", "text/*"}, "image/png"), "other families do not take images");
        check(!ClipboardImagePolicy.accepts(new String[0], "image/png"), "an editor that declares nothing takes no image");
        check(!ClipboardImagePolicy.accepts(null, "image/png"), "an editor without contentMimeTypes takes no image");
        check(!ClipboardImagePolicy.accepts(new String[] {"image/*"}, null), "no type, nothing to send");

        check("png".equals(ClipboardImagePolicy.extension("image/png")), "png extension");
        check("jpg".equals(ClipboardImagePolicy.extension("image/jpeg")), "jpeg extension");
        check("jpg".equals(ClipboardImagePolicy.extension("image/jpg")), "the non-standard jpg type still gets an extension");
        check(ClipboardImagePolicy.extension("image/x-synthetic") == null,
            "unknown types get no extension, a neutral one would be served as application/octet-stream");
        check(ClipboardImagePolicy.extension(null) == null, "no type, no extension");
        check(!ClipboardImagePolicy.identityText("content://a/1", "image/png")
                .equals(ClipboardImagePolicy.identityText("content://a/2", "image/png")),
            "different URIs are different copies");
        check(ClipboardImagePolicy.MAX_BYTES == 20L * 1024 * 1024, "the copy is capped at 20 MB");
        check("clipboard-images".equals(ClipboardImagePolicy.DIRECTORY),
            "the directory name matches the FileProvider path in res/xml/msime_file_paths.xml");

        Path root = Files.createTempDirectory("msime-clipboard-image-smoke");
        File directory = root.resolve(ClipboardImagePolicy.DIRECTORY).toFile();
        try {
            byte[] first = new byte[] {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};
            File copy = ClipboardImageCache.replace(new ByteArrayInputStream(first), directory, "png", 64);
            check(copy.getName().endsWith(".png") && Arrays.equals(first, Files.readAllBytes(copy.toPath())),
                "the copy holds the clipboard bytes under the type's extension");

            byte[] second = new byte[] {'G', 'I', 'F', '8', '9', 'a'};
            File next = ClipboardImageCache.replace(new ByteArrayInputStream(second), directory, "gif", 64);
            check(!copy.exists() && next.exists(), "a new copy replaces the previous one");
            check(!copy.getName().equals(next.getName()), "every copy gets a fresh name");
            check(directory.listFiles().length == 1, "at most one copy is kept");

            try {
                ClipboardImageCache.replace(new ByteArrayInputStream(new byte[65]), directory, "png", 64);
                throw new AssertionError("an oversized image must be refused");
            } catch (ClipboardImageCache.TooLargeException expected) {
                // 超过上限：拒绝，并且不留半成品。
            }
            check(directory.listFiles().length == 0, "an oversized image leaves nothing behind");

            try {
                ClipboardImageCache.replace(new ByteArrayInputStream(new byte[0]), directory, "png", 64);
                throw new AssertionError("an empty image must be refused");
            } catch (ClipboardImageCache.TooLargeException unexpected) {
                throw new AssertionError("an empty image is not too large");
            } catch (IOException expected) {
                // 空内容同样拒绝。
            }
            check(directory.listFiles().length == 0, "an empty image leaves nothing behind");

            ClipboardImageCache.replace(new ByteArrayInputStream(first), directory, "png", 64);
            ClipboardImageCache.clear(directory);
            check(directory.listFiles().length == 0, "clearing removes the copy");
            ClipboardImageCache.clear(root.resolve("missing").toFile());
        } finally {
            File[] left = directory.listFiles();
            if (left != null) for (File file : left) Files.deleteIfExists(file.toPath());
            Files.deleteIfExists(directory.toPath());
            Files.deleteIfExists(root);
        }
        System.out.println("ClipboardImagePolicySmoke ok");
    }
}
