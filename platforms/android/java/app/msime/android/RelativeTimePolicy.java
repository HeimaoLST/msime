package app.msime.android;

/** Shared Chinese relative-time labels for elapsed whole minutes. */
public final class RelativeTimePolicy {
    private RelativeTimePolicy() {}

    public static String minutesAgo(long minutes) {
        if (minutes < 1) return "刚刚";
        if (minutes < 60) return minutes + " 分钟前";
        long hours = minutes / 60;
        if (hours < 24) return hours + " 小时前";
        return (hours / 24) + " 天前";
    }

    /** Format an epoch timestamp that may be expressed in seconds or milliseconds. */
    public static String timestampAgo(long timestamp, long nowMillis) {
        if (timestamp <= 0) return "";
        long millis = timestamp < 100_000_000_000L ? timestamp * 1000 : timestamp;
        return millisAgo(nowMillis, millis);
    }

    /** Format an epoch-millisecond timestamp relative to the current time. */
    public static String millisAgo(long nowMillis, long thenMillis) {
        if (thenMillis <= 0) return "";
        long minutes = BoundsPolicy.nonNegative(nowMillis - thenMillis) / 60_000L;
        return minutesAgo(minutes);
    }

    /** Format an ISO-8601 timestamp, returning an empty label when parsing fails. */
    public static String isoAgo(String iso, long nowMillis) {
        return timestampAgo(isoMillis(iso), nowMillis);
    }

    /** Parse an ISO-8601 instant into epoch milliseconds, or zero when unusable. */
    public static long isoMillis(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        try {
            return java.time.Instant.parse(iso).toEpochMilli();
        } catch (java.time.format.DateTimeParseException | ArithmeticException malformed) {
            return 0L;
        }
    }
}
