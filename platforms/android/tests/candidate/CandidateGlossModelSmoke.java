import app.msime.android.CandidateGlossPolicy;
import app.msime.android.JsonPolicy;

public final class CandidateGlossModelSmoke {
    public static void main(String[] args) throws Exception {
        check(CandidateGlossPolicy.annotation("", "hello", false).isEmpty(), "opt-in display");
        check(CandidateGlossPolicy.annotation("", "hello", true).equals("hello"),
            "gloss display");
        check(CandidateGlossPolicy.accessibilitySuffix("", "hello", true).contains("英文释义"),
            "accessible gloss");
        // #6997：双拼辅助码这类 Engine 注释和释义同在一行，释义不再被挤到只有长按才看得到；第二目标语言的释义仍各占一行，候选条行数和只有释义时一样。
        check(CandidateGlossPolicy.annotation("(ab)", "my; mine", true).equals("(ab) · my; mine"),
            "a gloss follows the Engine annotation on the same row");
        check(CandidateGlossPolicy.annotation("(ab)", "my", false).equals("(ab)"),
            "the Engine annotation shows alone with glosses off");
        check(CandidateGlossPolicy.annotation("(ab)", "my\nmon", true).equals("(ab) · my\nmon"),
            "a second-language gloss keeps its own row after the Engine annotation");
        check(CandidateGlossPolicy.annotation("(ab)", "x".repeat(4097), true).equals("(ab)"),
            "an oversized gloss is hidden after the Engine annotation");
        check(CandidateGlossPolicy.annotation(null, null, true).isEmpty(),
            "a candidate with neither has no hint");
        check(CandidateGlossPolicy.accessibilitySuffix("(ab)", "my; mine", true)
                .equals("，提示：(ab)，英文释义：my; mine"), "accessible Engine annotation and gloss");
        check(CandidateGlossPolicy.accessibilitySuffix("(ab)", "my", false).equals("，提示：(ab)"),
            "accessible Engine annotation with glosses off");
        check(CandidateGlossPolicy.accessibilitySuffix("", "my", true).equals("，英文释义：my"),
            "accessible gloss alone");
        check(CandidateGlossPolicy.glossAccessibilitySuffix("my", true).equals("，英文释义：my")
                && CandidateGlossPolicy.glossAccessibilitySuffix("my", false).isEmpty(),
            "the gloss part of the spoken suffix follows the gloss switch");
        check(CandidateGlossPolicy.annotation("", "x".repeat(4097), true).isEmpty(),
            "oversized gloss hidden");

        // Korean Hanja rows: the 훈음 always shows, and a gloss shares its row rather than displacing it or adding a row.
        check(CandidateGlossPolicy.hanjaAnnotation("나라 이름 한", "", false).equals("나라 이름 한"),
            "the 훈음 shows with glosses off");
        check(CandidateGlossPolicy.hanjaAnnotation("나라 이름 한", "Korea", false).equals("나라 이름 한"),
            "a gloss stays hidden while glosses are off");
        check(CandidateGlossPolicy.hanjaAnnotation("나라 이름 한", "Korea", true).equals("나라 이름 한 · Korea"),
            "a gloss follows the 훈음 on the same row");
        check(CandidateGlossPolicy.hanjaAnnotation("나라 이름 한", "Korea\n韓国", true)
                .equals("나라 이름 한 · Korea\n韓国"), "a second-language gloss keeps its own row");
        check(CandidateGlossPolicy.hanjaAnnotation("", "Korea", true).equals("Korea"),
            "a Hanja without 훈음 shows its gloss alone");
        check(CandidateGlossPolicy.hanjaAnnotation(null, null, true).isEmpty(),
            "a Hanja with neither has no secondary row");
        check(CandidateGlossPolicy.hanjaAnnotation("나라 이름 한", "x".repeat(4097), true).equals("나라 이름 한"),
            "an oversized gloss is hidden under the 훈음");
        check(CandidateGlossPolicy.hanjaAccessibilitySuffix("나라 이름 한", "Korea", true)
                .equals("，训音：나라 이름 한，释义：Korea"), "accessible 훈음 and gloss");
        check(CandidateGlossPolicy.hanjaAccessibilitySuffix("나라 이름 한", "Korea", false)
                .equals("，训音：나라 이름 한"), "accessible 훈음 with glosses off");

        CandidateGlossPolicy.Token token = new CandidateGlossPolicy.Token(11, 7, 3);
        check(token.isCurrent(11, 7, 3), "matching token");
        check(!token.isCurrent(11, 8, 3) && !token.isCurrent(12, 7, 3)
            && !token.isCurrent(11, 7, 4), "stale session, generation and epoch rejected");
        expectFailure(() -> new CandidateGlossPolicy.Token(0, 7, 3));
        expectFailure(() -> new CandidateGlossPolicy.Token(11, -1, 3));

        check(CandidateGlossPolicy.strictInteger(Integer.valueOf(7)) == 7,
            "JSON integer values are accepted");
        check(CandidateGlossPolicy.strictInteger(Long.valueOf(Long.MAX_VALUE)) == Long.MAX_VALUE,
            "large JSON integer values retain precision");
        expectFailure(() -> CandidateGlossPolicy.strictInteger(Double.valueOf(7.5)));
        expectFailure(() -> CandidateGlossPolicy.strictInteger(Boolean.TRUE));
        expectFailure(() -> CandidateGlossPolicy.strictInteger("7"));
        check(CandidateGlossPolicy.strictOr(Long.valueOf(9), -1) == 9,
            "strict fallback preserves exact integers");
        check(CandidateGlossPolicy.strictOr(Double.valueOf(9.5), -1) == -1,
            "strict fallback rejects fractions");
        check(CandidateGlossPolicy.strictOr(Boolean.TRUE, -1) == -1,
            "strict fallback rejects booleans");
        check(CandidateGlossPolicy.strictString("hello").equals("hello"),
            "JSON strings are accepted");
        check(Boolean.TRUE.equals(JsonPolicy.strictBoolean(Boolean.TRUE)),
            "JSON booleans are accepted");
        check(JsonPolicy.strictBoolean("true") == null,
            "boolean strings are rejected instead of coerced");
        check(CandidateGlossPolicy.isApplied(Boolean.TRUE),
            "translation application accepts a JSON true flag");
        check(!CandidateGlossPolicy.isApplied("true")
                && !CandidateGlossPolicy.isApplied(Integer.valueOf(1)),
            "translation application rejects coercible flags");
        for (Object invalid : new Object[] {
                null, Long.valueOf(7), Boolean.TRUE, java.util.List.of("hello"),
                java.util.Map.of("text", "hello")}) {
            expectFailure(() -> CandidateGlossPolicy.strictString(invalid));
        }

        System.out.println("Android candidate gloss model: bounds, priority and stale guards passed");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void expectFailure(Runnable action) {
        try { action.run(); }
        catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("Invalid candidate gloss token accepted");
    }
}
