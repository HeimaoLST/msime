import app.msime.android.JapaneseNineKeyLayout;
import java.util.List;

public final class JapaneseNineKeyLayoutSmoke {
    static void check(boolean condition) { if (!condition) throw new AssertionError(); }

    public static void main(String[] args) {
        List<JapaneseNineKeyLayout.Key> keys = JapaneseNineKeyLayout.keys();
        check(keys.size() == 11);
        check(keys.stream().map(key -> key.kana().get(0)).toList().equals(
            List.of("あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "、")));
        check(keys.get(2).kana().equals(List.of("さ", "し", "す", "せ", "そ")));
        check(keys.get(2).strokes().equals(List.of("sa", "shi", "su", "se", "so")));
        check(keys.get(7).kana().equals(List.of("や", "「", "ゆ", "」", "よ")));
        check(keys.get(7).strokes().equals(List.of("ya", "", "yu", "", "yo")));
        check(keys.get(9).kana().equals(List.of("わ", "を", "ん", "ー", "〜")));
        check(keys.get(9).strokes().equals(List.of("wa", "wo", "n'", "-", "")));
        check(keys.get(10).kana().equals(List.of("、", "。", "？", "！", "…")));
        check(keys.get(10).strokes().stream().allMatch(String::isEmpty));
        List<JapaneseNineKeyLayout.Key> digitKeys = JapaneseNineKeyLayout.digitKeys();
        check(digitKeys.size() == 11);
        check(digitKeys.stream().map(key -> key.kana().get(0)).toList().equals(
            List.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "、")));
        check(digitKeys.get(0).kana().equals(List.of("1", "☆", "♪", "→", "")));
        check(digitKeys.get(9).kana().equals(List.of("0", "〜", "…", "ー", "")));
        check(digitKeys.get(10).kana().equals(List.of("、", "。", "？", "！", "…")));
        check(digitKeys.stream().allMatch(key -> key.strokes().stream().allMatch(String::isEmpty)));
        check(JapaneseNineKeyLayout.digitBrackets().equals(
            List.of("（", "）", "「", "」", "『", "』", "【", "】")));
        check(JapaneseNineKeyLayout.direction(0, 0, 12) == 0);
        check(JapaneseNineKeyLayout.direction(-13, 2, 12) == 1);
        check(JapaneseNineKeyLayout.direction(1, -13, 12) == 2);
        check(JapaneseNineKeyLayout.direction(13, 2, 12) == 3);
        check(JapaneseNineKeyLayout.direction(1, 13, 12) == 4);
        check(JapaneseNineKeyLayout.toggleCycle(keys.get(0)).equals(List.of(0, 1, 2, 3, 4)));
        check(JapaneseNineKeyLayout.toggleCycle(keys.get(7)).equals(List.of(0, 2, 4)));
        check(JapaneseNineKeyLayout.toggleCycle(keys.get(9)).equals(List.of(0, 1, 2, 3)));
        check(JapaneseNineKeyLayout.toggleCycle(keys.get(10)).equals(List.of(0, 1, 2, 3, 4)));
        List<Integer> ya = JapaneseNineKeyLayout.toggleCycle(keys.get(7));
        check(JapaneseNineKeyLayout.toggleStep(ya, 0, 1) == 2);
        check(JapaneseNineKeyLayout.toggleStep(ya, 4, 1) == 0);
        check(JapaneseNineKeyLayout.toggleStep(ya, 0, -1) == 4);
        check(JapaneseNineKeyLayout.toggleStep(ya, 1, 1) == 0);
        // 按下时提示中间格写的、松手轻点打出的，是同一个假名：时间窗内是循环里的下一个，边界和轻点的判断一致（恰好 1000 ms 仍算连点）。
        JapaneseNineKeyLayout.Key a = keys.get(0);
        check(JapaneseNineKeyLayout.withinToggleWindow(JapaneseNineKeyLayout.TOGGLE_WINDOW_MS));
        check(!JapaneseNineKeyLayout.withinToggleWindow(JapaneseNineKeyLayout.TOGGLE_WINDOW_MS + 1));
        check(JapaneseNineKeyLayout.tapDirection(a, false, a, 0, 500) == 1);
        check(JapaneseNineKeyLayout.tapDirection(a, false, a, 4, 500) == 0);
        check(JapaneseNineKeyLayout.tapDirection(a, false, a, 0, 1000) == 1);
        check(JapaneseNineKeyLayout.tapDirection(a, false, a, 0, 1001) == 0);
        check(JapaneseNineKeyLayout.tapDirection(a, false, null, 0, 0) == 0);
        check(JapaneseNineKeyLayout.tapDirection(a, false, keys.get(1), 0, 0) == 0);
        check(JapaneseNineKeyLayout.tapDirection(a, true, a, 0, 0) == 0);
        // や、わ 的循环跳过「」〜 这类直接上屏的方向，、 键只在标点之间循环。
        JapaneseNineKeyLayout.Key yaKey = keys.get(7);
        check(JapaneseNineKeyLayout.tapDirection(yaKey, false, yaKey, 0, 0) == 2);
        check(JapaneseNineKeyLayout.tapDirection(yaKey, false, yaKey, 2, 0) == 4);
        check(JapaneseNineKeyLayout.tapDirection(yaKey, false, yaKey, 4, 0) == 0);
        JapaneseNineKeyLayout.Key wa = keys.get(9);
        check(JapaneseNineKeyLayout.tapDirection(wa, false, wa, 3, 0) == 0);
        JapaneseNineKeyLayout.Key comma = keys.get(10);
        check(JapaneseNineKeyLayout.tapDirection(comma, false, comma, 0, 0) == 1);
        check(JapaneseNineKeyLayout.toggleRemainingMillis(a, false, a, 300) == 700);
        check(JapaneseNineKeyLayout.toggleRemainingMillis(a, false, a, 1000) == 0);
        check(JapaneseNineKeyLayout.toggleRemainingMillis(a, false, a, 1001) == -1);
        check(JapaneseNineKeyLayout.toggleRemainingMillis(a, false, null, 0) == -1);
        check(JapaneseNineKeyLayout.toggleRemainingMillis(a, false, keys.get(1), 0) == -1);
        check(JapaneseNineKeyLayout.toggleRemainingMillis(a, true, a, 0) == -1);
        check(!JapaneseNineKeyLayout.endsWithPendingRomaji(""));
        check(!JapaneseNineKeyLayout.endsWithPendingRomaji(null));
        check(!JapaneseNineKeyLayout.endsWithPendingRomaji("こんち"));
        check(!JapaneseNineKeyLayout.endsWithPendingRomaji("こー"));
        check(JapaneseNineKeyLayout.endsWithPendingRomaji("こんch"));
        check(JapaneseNineKeyLayout.endsWithPendingRomaji("こn'"));
        check(JapaneseNineKeyLayout.endsWithPendingRomaji("こn"));
        check(JapaneseNineKeyLayout.endsWithPendingRomaji("c"));
        check(keys.stream().flatMap(key -> key.strokes().stream())
            .allMatch(stroke -> stroke.length() <= JapaneseNineKeyLayout.LONGEST_STROKE));
        try {
            keys.get(0).kana().add("bad");
            throw new AssertionError();
        } catch (UnsupportedOperationException expected) { }
        System.out.println("Android Japanese nine-key: kana, strokes and flick directions passed");
    }
}
