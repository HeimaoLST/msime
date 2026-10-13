package app.msime.android;

import android.content.Context;
import android.net.Uri;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

/**
 * 发送「最近复制」图片（#6781）时落在应用缓存里的那一份副本。
 *
 * <p>不直接把剪贴板里的 URI 转交给输入框：键盘读剪贴板拿到的读权限是临时的，也不能再转授给别的应用。所以先把图读进 `cache/clipboard-images/`，再经本应用的 FileProvider（`${applicationId}.files`）给出 content URI，由 `commitContent` 的 `INPUT_CONTENT_GRANT_READ_URI_PERMISSION` 授给输入框。目录里任何时候至多一张：写新的之前先删掉旧的，发出几分钟后、键盘进程启动和退出时也都清空（{@link ClipboardImagePolicy#RETENTION_MS}）。
 */
public final class ClipboardImageCache {
    private static final String FILE_PROVIDER = "androidx.core.content.FileProvider";
    private static final int BUFFER_BYTES = 64 * 1024;

    private ClipboardImageCache() {}

    /** 图片超过 {@link ClipboardImagePolicy#MAX_BYTES}，半成品已经删掉。 */
    public static final class TooLargeException extends IOException {
        private static final long serialVersionUID = 1L;

        TooLargeException() { super("clipboard image too large"); }
    }

    /**
     * 清掉 `directory` 里的旧副本，再把 `source` 写成一个以 `extension` 结尾的新文件并返回它。超过 `maxBytes` 抛 {@link TooLargeException}，读到的是空内容或写入失败时抛 IOException，两种情况都不留下半成品。文件名每次随机，免得收图的应用按 URI 缓存，把上一张图当成这一张。
     *
     * <p>扩展名由调用方定：FileProvider 按它报出副本的类型，服务要保证它反查出来是图片（`MSIMEInputService.clipboardImageExtension`）。
     */
    public static File replace(InputStream source, File directory, String extension, long maxBytes)
            throws IOException {
        if (source == null || directory == null) throw new IOException("clipboard image unavailable");
        SafePaths.ensureDirectory(directory.toPath());
        clear(directory);
        File target = new File(directory, "clip-" + UUID.randomUUID() + "." + extension);
        long total = 0;
        try (OutputStream output = Files.newOutputStream(target.toPath(),
                StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS)) {
            byte[] buffer = new byte[BUFFER_BYTES];
            int read;
            while ((read = source.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) throw new TooLargeException();
                output.write(buffer, 0, read);
            }
        } catch (IOException | RuntimeException error) {
            FilePolicy.deleteQuietly(target);
            throw error;
        }
        if (total == 0) {
            FilePolicy.deleteQuietly(target);
            throw new IOException("clipboard image empty");
        }
        return target;
    }

    /** 删掉目录里的所有副本；目录不存在时什么也不做。 */
    public static void clear(File directory) {
        File[] files = directory == null ? null : directory.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (file.isFile()) FilePolicy.deleteQuietly(file);
        }
    }

    /**
     * 副本的 content URI，经本应用的 FileProvider 生成。
     *
     * <p>按名字反射调用 androidx 的 `FileProvider.getUriForFile`，和 {@link HandwritingRecognizerFactory} 对 ML Kit 的做法一样：`check-host.sh` 的 JVM 冒烟只拿 android.jar 编译不引用 androidx 的源文件，服务直接 import FileProvider 就会被整个排除在那一步之外。FileProvider 声明在主进程，键盘在 `:ime` 进程；getUriForFile 只读 provider 的元数据、按同一个缓存目录算路径，不需要 provider 跑在本进程。
     */
    public static Uri contentUri(Context context, File file) throws IOException {
        try {
            Object uri = Class.forName(FILE_PROVIDER)
                .getMethod("getUriForFile", Context.class, String.class, File.class)
                .invoke(null, context, context.getPackageName() + ".files", file);
            if (uri instanceof Uri value) return value;
        } catch (InvocationTargetException error) {
            throw new IOException("clipboard image not shareable", error.getCause());
        } catch (ReflectiveOperationException | LinkageError | SecurityException error) {
            throw new IOException("file provider unavailable", error);
        }
        throw new IOException("file provider unavailable");
    }
}
