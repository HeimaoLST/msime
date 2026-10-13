package app.msime.android;

import java.util.Locale;

/**
 * 「最近复制」里的图片（#6781）：系统剪贴板里是一张图片时，在当前输入框声明能收图片（`EditorInfo.contentMimeTypes`）的前提下，工具栏那一行换成「发送复制的图片」，点一下经 `InputConnection.commitContent` 发出去。
 *
 * <p>这里只放不依赖 Android 的判断：剪贴板里哪一种图片类型、输入框收不收这种类型、副本放在哪个目录、最大多大、发出后留多久。读剪贴板、复制和提交都在服务里。
 */
public final class ClipboardImagePolicy {
    /** 发出去的副本放在应用缓存下的这个目录里，`res/xml/msime_file_paths.xml` 只把它按同名暴露给 FileProvider。 */
    public static final String DIRECTORY = "clipboard-images";
    /** 复制一张图最多读这么多字节，多了就不发：键盘进程不该为一张剪贴板图片写几百兆的缓存。 */
    public static final long MAX_BYTES = 20L * 1024 * 1024;
    /** 发出后副本留多久。收图的应用一般在 commitContent 当时就把图读走，留几分钟是给读得慢的应用；过了就删掉，下一张发出前、键盘进程启动和退出时也都会删。 */
    public static final long RETENTION_MS = 5 * 60_000;
    /** 工具栏上这一行的文字。 */
    public static final String LABEL = "发送复制的图片";

    private ClipboardImagePolicy() {}

    /** 剪贴板描述里的第一个具体图片类型（`image/png` 这种，不含通配符），没有时为 null。 */
    public static String imageMimeType(String[] clipMimeTypes) {
        if (clipMimeTypes == null) return null;
        for (String type : clipMimeTypes) {
            String normalized = normalized(type);
            if (normalized == null || !normalized.startsWith("image/")) continue;
            String subtype = normalized.substring("image/".length());
            if (subtype.isEmpty() || subtype.contains("*")) continue;
            return normalized;
        }
        return null;
    }

    /**
     * 输入框声明的可接收类型里有没有能收下 `mimeType` 的。规则与系统的 `ClipDescription.compareMimeTypes` 相同：全通配（两边都是星号）收一切，`image/*` 收所有图片，其余按完整类型比较，大小写不敏感。输入框什么都没声明（null 或空）就是不收图片，这时工具栏不提供发送。
     */
    public static boolean accepts(String[] editorMimeTypes, String mimeType) {
        String concrete = normalized(mimeType);
        if (editorMimeTypes == null || concrete == null) return false;
        int slash = concrete.indexOf('/');
        if (slash <= 0) return false;
        String concreteType = concrete.substring(0, slash);
        for (String accepted : editorMimeTypes) {
            String desired = normalized(accepted);
            if (desired == null) continue;
            if (desired.equals("*/*") || desired.equals(concrete)) return true;
            if (desired.equals(concreteType + "/*")) return true;
        }
        return false;
    }

    /**
     * 常见几种图片类型的扩展名，系统的 `MimeTypeMap` 不认这种类型时由服务拿来补位（`image/jpg` 这种非标准写法就靠它）；不在表里的为 null。
     *
     * <p>不给未知类型一个中性的扩展名：FileProvider 报给收图应用的类型只按扩展名经 `MimeTypeMap` 反查，`.img` 会被报成 `application/octet-stream`，和键盘在 commitContent 里声明的图片类型对不上。
     */
    public static String extension(String mimeType) {
        String normalized = normalized(mimeType);
        if (normalized == null) return null;
        return switch (normalized) {
            case "image/png" -> "png";
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/gif" -> "gif";
            case "image/webp" -> "webp";
            case "image/heic" -> "heic";
            case "image/heif" -> "heif";
            case "image/bmp" -> "bmp";
            default -> null;
        };
    }

    /** 剪贴板里这张图的身份文字：交给 {@link ClipboardCapturePolicy#identity} 和复制时刻一起区分不同的复制。只在内存里用，不落盘。 */
    public static String identityText(String uri, String mimeType) {
        return "image:" + (mimeType == null ? "" : mimeType) + ":" + (uri == null ? "" : uri);
    }

    private static String normalized(String mimeType) {
        if (mimeType == null) return null;
        String trimmed = mimeType.strip();
        int parameters = trimmed.indexOf(';');
        if (parameters >= 0) trimmed = trimmed.substring(0, parameters).strip();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(Locale.ROOT);
    }
}
