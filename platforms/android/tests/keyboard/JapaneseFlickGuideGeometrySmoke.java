import app.msime.android.JapaneseFlickGuideGeometry;
import app.msime.android.JapaneseFlickGuideGeometry.Guide;

public final class JapaneseFlickGuideGeometrySmoke {
    static void check(boolean condition) { if (!condition) throw new AssertionError(); }

    static final float EPSILON = 0.001f;

    static boolean near(float left, float right) { return Math.abs(left - right) < EPSILON; }

    /** 五格都在方框里、互不重叠，左上右下各在中间格的那一侧。 */
    static void checkCells(Guide guide) {
        for (int direction = 0; direction < 5; direction++) {
            float left = guide.cellLeft(direction);
            float top = guide.cellTop(direction);
            check(left >= guide.left() - EPSILON && left + guide.cellWidth() <= guide.right() + EPSILON);
            check(top >= guide.top() - EPSILON && top + guide.cellHeight() <= guide.bottom() + EPSILON);
            for (int other = direction + 1; other < 5; other++) {
                boolean apartX = guide.cellLeft(other) >= left + guide.cellWidth() - EPSILON
                    || left >= guide.cellLeft(other) + guide.cellWidth() - EPSILON;
                boolean apartY = guide.cellTop(other) >= top + guide.cellHeight() - EPSILON
                    || top >= guide.cellTop(other) + guide.cellHeight() - EPSILON;
                check(apartX || apartY);
            }
        }
        float centerLeft = guide.cellLeft(0);
        float centerTop = guide.cellTop(0);
        check(near(guide.cellLeft(1) + guide.cellWidth(), centerLeft) && near(guide.cellTop(1), centerTop));
        check(near(guide.cellTop(2) + guide.cellHeight(), centerTop) && near(guide.cellLeft(2), centerLeft));
        check(near(guide.cellLeft(3), centerLeft + guide.cellWidth()) && near(guide.cellTop(3), centerTop));
        check(near(guide.cellTop(4), centerTop + guide.cellHeight()) && near(guide.cellLeft(4), centerLeft));
    }

    /** 方框完全在覆盖层里。 */
    static void checkInside(Guide guide, float rootWidth, float rootHeight) {
        check(guide.left() >= -EPSILON && guide.top() >= -EPSILON);
        check(guide.right() <= rootWidth + EPSILON && guide.bottom() <= rootHeight + EPSILON);
    }

    public static void main(String[] args) {
        float rootWidth = 1080, rootHeight = 700, outset = 10, minCell = 50;
        // 键盘中间的一个键：方框就是键四边各外扩 outset，中心与键重合，只比键大一圈，不会伸到相邻键的中心。
        float keyLeft = 300, keyTop = 300, keyWidth = 200, keyHeight = 150;
        Guide middle = JapaneseFlickGuideGeometry.layout(
            keyLeft, keyTop, keyWidth, keyHeight, rootWidth, rootHeight, outset, minCell);
        check(near(middle.left(), keyLeft - outset) && near(middle.top(), keyTop - outset));
        check(near(middle.width(), keyWidth + 2 * outset) && near(middle.height(), keyHeight + 2 * outset));
        check(middle.right() < keyLeft + keyWidth + keyWidth / 2f);
        check(middle.bottom() < keyTop + keyHeight + keyHeight / 2f);
        checkCells(middle);
        checkInside(middle, rootWidth, rootHeight);

        // 贴着四条边的键：方框平移进覆盖层，大小不变，不被裁掉。
        float[][] edgeKeys = {
            {0, 300}, {rootWidth - keyWidth, 300}, {300, 0}, {300, rootHeight - keyHeight},
            {0, 0}, {rootWidth - keyWidth, rootHeight - keyHeight},
        };
        for (float[] edge : edgeKeys) {
            Guide guide = JapaneseFlickGuideGeometry.layout(
                edge[0], edge[1], keyWidth, keyHeight, rootWidth, rootHeight, outset, minCell);
            check(near(guide.width(), middle.width()) && near(guide.height(), middle.height()));
            checkInside(guide, rootWidth, rootHeight);
            checkCells(guide);
        }
        Guide leftEdge = JapaneseFlickGuideGeometry.layout(
            0, 300, keyWidth, keyHeight, rootWidth, rootHeight, outset, minCell);
        check(near(leftEdge.left(), 0));
        Guide bottomEdge = JapaneseFlickGuideGeometry.layout(
            300, rootHeight - keyHeight, keyWidth, keyHeight, rootWidth, rootHeight, outset, minCell);
        check(near(bottomEdge.bottom(), rootHeight));

        // 比最小格还小的键：方框按 3 × minCell 放大，仍以键为中心，五格不重叠。
        Guide tiny = JapaneseFlickGuideGeometry.layout(
            500, 400, 40, 30, rootWidth, rootHeight, outset, minCell);
        check(near(tiny.cellWidth(), minCell) && near(tiny.cellHeight(), minCell));
        check(near(tiny.left() + tiny.width() / 2f, 520) && near(tiny.top() + tiny.height() / 2f, 415));
        checkCells(tiny);
        checkInside(tiny, rootWidth, rootHeight);

        // 覆盖层还没量出大小（0 × 0）时贴左上角，不出现负坐标。
        Guide unmeasured = JapaneseFlickGuideGeometry.layout(
            300, 300, keyWidth, keyHeight, 0, 0, outset, minCell);
        check(near(unmeasured.left(), 0) && near(unmeasured.top(), 0));

        for (int direction : new int[] {-1, 5}) {
            try {
                middle.cellLeft(direction);
                throw new AssertionError();
            } catch (IllegalArgumentException expected) { }
        }
        try {
            JapaneseFlickGuideGeometry.layout(0, 0, -1, 10, rootWidth, rootHeight, outset, minCell);
            throw new AssertionError();
        } catch (IllegalArgumentException expected) { }
        System.out.println("Android Japanese flick guide: in-key layout, edge clamping and minimum cells passed");
    }
}
