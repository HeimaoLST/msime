import app.msime.android.CaretCandidatePolicy;

public final class CaretCandidatePolicySmoke {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        // 生效条件：开关、键区收起、编辑器答应报告位置、这一次没有退回底部，缺一不可。
        check(CaretCandidatePolicy.active(true, true, true, false), "follows the caret");
        check(!CaretCandidatePolicy.active(false, true, true, false), "switch off keeps the bottom strip");
        check(!CaretCandidatePolicy.active(true, false, true, false), "a panel over the keys docks the keyboard");
        check(!CaretCandidatePolicy.active(true, true, false, false), "an editor without CursorAnchorInfo docks");
        check(!CaretCandidatePolicy.active(true, true, true, true), "docked for this composition");

        // 退回底部：要显示候选栏、不知道光标在哪儿、也不在等第一次报告时退回，退回后保持。
        check(CaretCandidatePolicy.docked(false, true, true, false, false), "no anchor when the strip appears");
        check(!CaretCandidatePolicy.docked(false, true, true, false, true), "still waiting for the first anchor");
        check(!CaretCandidatePolicy.docked(false, true, true, true, false), "known anchor stays at the caret");
        check(!CaretCandidatePolicy.docked(false, true, false, false, false), "idle without anchor does not dock");
        check(!CaretCandidatePolicy.docked(false, false, true, false, false), "not following, nothing to dock");
        check(CaretCandidatePolicy.docked(true, true, true, true, false), "docked stays docked");
        // 显示：不跟随光标时照旧；跟随时有内容且知道位置才显示，等位置期间和空闲时不显示。
        check(CaretCandidatePolicy.surfaceShown(false, false, false), "docked strip is always drawn");
        check(CaretCandidatePolicy.surfaceShown(true, true, true), "composing with a known anchor");
        check(!CaretCandidatePolicy.surfaceShown(true, true, false), "hidden while waiting for the anchor");
        check(!CaretCandidatePolicy.surfaceShown(true, false, true), "idle shows nothing");
        check(CaretCandidatePolicy.ANCHOR_WAIT_MS > 0 && CaretCandidatePolicy.ANCHOR_WAIT_MS <= 1000,
            "the first-anchor wait is short");
        // 窗口：跟随光标且空闲时收起整个输入法窗口，返回键第一下才落到应用上；有内容、不跟随光标时不收起。
        check(CaretCandidatePolicy.hidesWindow(true, false), "idle caret mode hides the window");
        check(!CaretCandidatePolicy.hidesWindow(true, true), "composing keeps the window");
        check(!CaretCandidatePolicy.hidesWindow(false, false), "the docked strip keeps its toolbar");
        check(!CaretCandidatePolicy.hidesWindow(false, true), "the docked strip keeps the window while composing");
        // 再收起的间隔：第一次立即收；应用刚把窗口叫回来时等满间隔，不来回打转。
        check(CaretCandidatePolicy.rehideDelay(Long.MIN_VALUE, 0) == 0, "the first idle hide is immediate");
        check(CaretCandidatePolicy.rehideDelay(1000, 1200) == CaretCandidatePolicy.WINDOW_REHIDE_MS - 200,
            "a window shown again right away waits out the interval");
        check(CaretCandidatePolicy.rehideDelay(1000, 1000 + CaretCandidatePolicy.WINDOW_REHIDE_MS) == 0,
            "the interval has passed");
        // 认出自己的收起：发过请求、在时限之内（一次请求可能分几次落地）；时限之后或没发过的都是用户收起。
        check(CaretCandidatePolicy.ownHide(true, 1000, 1500), "the idle hide landing after the keyboard animation");
        check(!CaretCandidatePolicy.ownHide(false, 1000, 1500), "a hide this service did not request");
        check(!CaretCandidatePolicy.ownHide(true, 1000, 1000 + CaretCandidatePolicy.HIDE_LANDING_MS + 1),
            "an old request no longer claims the next hide");
        check(CaretCandidatePolicy.WINDOW_REHIDE_MS >= 100 && CaretCandidatePolicy.WINDOW_REHIDE_MS <= 1000,
            "the rehide interval is short");
        // 收到位置：空闲时回到光标旁，组字中留在底部。
        check(!CaretCandidatePolicy.dockedAfterAnchor(true, false), "idle anchor undocks");
        check(CaretCandidatePolicy.dockedAfterAnchor(true, true), "no jump while composing");
        check(!CaretCandidatePolicy.dockedAfterAnchor(false, true), "never docks on an anchor");

        // 水平：与光标左对齐，夹在窗口里；比窗口宽时贴左；位置未知时居中。
        check(CaretCandidatePolicy.x(120f, 400, 0, 1080) == 120, "aligned with the caret");
        check(CaretCandidatePolicy.x(900f, 400, 0, 1080) == 680, "clamped at the right edge");
        check(CaretCandidatePolicy.x(-30f, 400, 16, 1080) == 16, "clamped at the left edge");
        check(CaretCandidatePolicy.x(300f, 1200, 0, 1080) == 0, "wider than the window starts at the left");
        check(CaretCandidatePolicy.x(Float.NaN, 400, 0, 1080) == 340, "unknown anchor is centred");
        check(CaretCandidatePolicy.x(Float.NaN, 1200, 0, 1080) == 0, "unknown anchor never leaves the window");

        // 竖直：光标下方；靠近底边翻到上方；两边都放不下时取空间大的一侧并夹住；位置未知时贴底。
        check(CaretCandidatePolicy.y(300f, 340f, 120, 60, 2000, 8) == 348, "below the caret line");
        check(CaretCandidatePolicy.y(1900f, 1940f, 120, 60, 2000, 8) == 1772, "flipped above near the bottom");
        check(CaretCandidatePolicy.y(1880f, 1880f, 120, 60, 2000, 8) == 1752,
            "bottom edge exactly: flipped because 1888 + 120 crosses 2000");
        check(CaretCandidatePolicy.y(150f, 190f, 120, 60, 300, 8) == 180,
            "neither side fits: more room below, clamped to the bottom");
        check(CaretCandidatePolicy.y(200f, 240f, 200, 60, 300, 8) == 60,
            "neither side fits: more room above, clamped to the top");
        check(CaretCandidatePolicy.y(-500f, -460f, 120, 60, 2000, 8) == 60, "caret scrolled above the window");
        check(CaretCandidatePolicy.y(2400f, 2440f, 120, 60, 2000, 8) == 1880, "caret scrolled below the window");
        // 组字折行：位置的上下边是整段组字所占的行（300–340 与 340–380 两行），候选栏放在最后一行下方，翻到上方时在第一行上方。
        check(CaretCandidatePolicy.y(300f, 380f, 120, 60, 2000, 8) == 388, "below the last line of a wrapped composition");
        check(CaretCandidatePolicy.y(1840f, 1920f, 120, 60, 2000, 8) == 1712,
            "above the first line of a wrapped composition near the bottom");
        check(CaretCandidatePolicy.y(Float.NaN, 340f, 120, 60, 2000, 8) == 1880, "unknown anchor sits at the bottom");
        check(CaretCandidatePolicy.y(300f, 340f, 3000, 60, 2000, 8) == 60, "taller than the window starts at the top");
        System.out.println("Android caret candidates: activation, docking, visibility, window and placement passed");
    }
}
