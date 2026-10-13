package app.msime.android;

import java.io.File;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;

/** 共享文件操作策略。 */
public final class FilePolicy {
    private FilePolicy() {}

    /** 删除文件；删除失败时交给虚拟机退出钩子再次尝试。 */
    public static void deleteQuietly(File file) {
        if (file.exists() && !file.delete()) file.deleteOnExit();
    }

    /** 在目标文件所在目录写入临时文件，再原子替换目标；不支持原子替换时回退到普通替换。 */
    public static void writeAtomically(Path file, byte[] content) throws IOException {
        if (file == null) throw new IllegalArgumentException("file");
        if (content == null) throw new IllegalArgumentException("content");
        Path parent = file.getParent();
        if (parent == null) throw new IOException("file parent unavailable");
        String name = file.getFileName().toString();
        String prefix = name.length() >= 3 ? name + "." : "msime-" + name + ".";
        Path temporary = Files.createTempFile(parent, prefix, ".tmp");
        try {
            Files.write(temporary, content, StandardOpenOption.TRUNCATE_EXISTING);
            try {
                Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, file, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }
}
