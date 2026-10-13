package app.msime.android;

/** Pure lifecycle and presentation rules for optional offline candidate glosses. */
public final class CandidateGlossPolicy {
    public static final int MAX_ENTRY_BYTES = 4096;

    public record Token(long session, long generation, long epoch) {
        public Token {
            if (session <= 0 || generation < 0 || epoch < 0)
                throw new IllegalArgumentException("Invalid candidate gloss token");
        }

        public boolean isCurrent(long currentSession, long currentGeneration, long currentEpoch) {
            return session == currentSession && generation == currentGeneration
                && epoch == currentEpoch;
        }
    }

    private CandidateGlossPolicy() {}

    /** Read a JSON integer without org.json's lossy numeric coercion. */
    public static long strictInteger(Object value) {
        Long parsed = JsonPolicy.strictLong(value);
        if (parsed == null)
            throw new IllegalArgumentException("Expected JSON integer");
        return parsed;
    }

    /** Return a fallback for a missing or malformed protocol integer instead of coercing it. */
    public static long strictOr(Object value, long fallback) {
        try {
            return strictInteger(value);
        } catch (IllegalArgumentException error) {
            return fallback;
        }
    }

    /** Read a JSON string without org.json's implicit scalar-to-string coercion. */
    public static String strictString(Object value) {
        String parsed = JsonPolicy.strictString(value);
        if (parsed == null) throw new IllegalArgumentException("Expected JSON string");
        return parsed;
    }

    /** Whether an apply-translations response carries a typed JSON success flag. */
    public static boolean isApplied(Object value) {
        return JsonPolicy.strictTrue(value);
    }

    /**
     * 候选的提示位：Engine 注释（双拼辅助码、五笔剩余编码等）在前，释义跟在同一行后面。
     *
     * <p>以前 Engine 注释独占提示位，双拼默认在候选栏显示辅助码，每个候选都带辅助码，释义就只能长按才看到（#6997）。和韩语汉字的 훈음 一样共用第一行而不是另起一行：候选条按释义行数预留高度（{@link CandidateTranslationPolicy#reservedGlossRows}），另起一行就得看辅助码显不显示来加高，切方案或开关辅助码时键盘高度会跳。第二目标语言的释义仍各占一行，行数和只有释义时相同。
     */
    public static String annotation(
            String engineAnnotation, String translation, boolean glossEnabled) {
        String gloss = glossEnabled && validEntry(translation) ? translation : "";
        if (engineAnnotation == null || engineAnnotation.isEmpty()) return gloss;
        return gloss.isEmpty() ? engineAnnotation : engineAnnotation + " · " + gloss;
    }

    /**
     * The secondary rows of a Korean Hanja candidate, each drawn on its own line under the Hanja.
     *
     * <p>The 훈음 (for example 나라 이름 한) is the Engine annotation of a Hanja row and is always shown, whatever the gloss and translation preferences say, because it is how a Hanja is told apart from its homophones. A gloss or translation the candidate carries follows on the next row when glosses are on, instead of being displaced by the 훈음 as the shared hint slot would. Display text only: selection commits the candidate text by its index, never these rows.
     */
    public static String hanjaAnnotation(
            String reading, String translation, boolean glossEnabled) {
        String gloss = glossEnabled && validEntry(translation) ? translation : "";
        if (reading == null || reading.isEmpty()) return gloss;
        // 훈음和第一行释义共用一行：另起一行会让韩语的候选条比其他方案多出一行，键盘一切到韩语就整体变高。
        return gloss.isEmpty() ? reading : reading + " · " + gloss;
    }

    public static String hanjaAccessibilitySuffix(
            String reading, String translation, boolean glossEnabled) {
        String suffix = reading == null || reading.isEmpty() ? "" : "，训音：" + reading;
        String gloss = glossEnabled && validEntry(translation) ? translation : "";
        return gloss.isEmpty() ? suffix : suffix + "，释义：" + gloss;
    }

    /** 读屏念的提示和释义，和 {@link #annotation} 画出来的一致：两者都有时都念。 */
    public static String accessibilitySuffix(
            String engineAnnotation, String translation, boolean glossEnabled) {
        String hint = engineAnnotation == null || engineAnnotation.isEmpty() ? "" : "，提示：" + engineAnnotation;
        return hint + glossAccessibilitySuffix(translation, glossEnabled);
    }

    /** 读屏念的释义部分，没有释义或释义关着时为空。 */
    public static String glossAccessibilitySuffix(String translation, boolean glossEnabled) {
        return glossEnabled && validEntry(translation) ? "，英文释义：" + translation : "";
    }

    public static boolean validEntry(String value) {
        return value != null && !value.isEmpty()
            && TextPolicy.utf8Length(value) <= MAX_ENTRY_BYTES;
    }
}
