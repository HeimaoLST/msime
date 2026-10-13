import app.msime.android.CommunitySkinCache;
import app.msime.android.JsonPolicy;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;

public final class CommunitySkinCacheSmoke {
    public static void main(String[] arguments) throws Exception {
        check("synthetic".equals(JsonPolicy.strictString("synthetic")),
            "community cache text accepts JSON strings");
        check(JsonPolicy.strictString(7) == null,
            "community cache text rejects numbers instead of coercing them");
        check(JsonPolicy.strictString(Boolean.TRUE) == null,
            "community cache text rejects booleans instead of coercing them");
        Path root = Files.createTempDirectory("community-skin-cache-");
        Path outside = Files.createTempFile("community-skin-cache-hardlink-", ".json");
        try {
            Files.writeString(outside,
                "[{\"id\":\"outside\",\"name\":\"outside\",\"author\":\"\",\"design\":{}}]");
            Files.createLink(root.resolve("community-skins.json"), outside);
            check(CommunitySkinCache.read(root).isEmpty(),
                "community cache rejects hard-linked files");
        } finally {
            Files.deleteIfExists(root.resolve("community-skins.json"));
            Files.deleteIfExists(root);
            Files.deleteIfExists(outside);
        }
        staleness();
        System.out.println("CommunitySkinCache smoke passed");
    }

    /** 皮肤页按缓存新旧决定要不要联网重拉目录。 */
    private static void staleness() throws Exception {
        long now = 1_800_000_000_000L;
        long age = CommunitySkinCache.MAX_AGE_MILLIS;
        check(!CommunitySkinCache.stale(now, now), "a cache written just now is fresh");
        check(!CommunitySkinCache.stale(now - age + 1, now), "a cache just under the age limit is fresh");
        check(CommunitySkinCache.stale(now - age, now), "a cache at the age limit is stale");
        check(CommunitySkinCache.stale(0L, now), "a very old cache is stale");
        check(CommunitySkinCache.stale(now + 1, now), "a cache written in the future (clock moved back) is stale");

        Path root = Files.createTempDirectory("community-skin-cache-age-").toRealPath();
        Path file = root.resolve("community-skins.json");
        try {
            check(CommunitySkinCache.stale(root, now), "a missing cache is stale");
            Files.writeString(file, "[]");
            Files.setLastModifiedTime(file, java.nio.file.attribute.FileTime.fromMillis(now - 1000));
            check(!CommunitySkinCache.stale(root, now), "a cache file written a second ago is fresh");
            Files.setLastModifiedTime(file, java.nio.file.attribute.FileTime.fromMillis(now - age - 1000));
            check(CommunitySkinCache.stale(root, now), "an old cache file is stale");
            Files.delete(file);
            Files.createDirectory(file);
            check(CommunitySkinCache.stale(root, now), "a directory in place of the cache is stale");
        } finally {
            Files.deleteIfExists(file);
            Files.deleteIfExists(root);
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
