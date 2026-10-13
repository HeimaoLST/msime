package app.msime.android;

/**
 * 「物理键盘时候选栏跟随光标」（#6792）：外接键盘的候选条模式（{@link HardwareKeyboardModePolicy}）里，候选栏不再停在屏幕底部，而是像桌面端那样出现在输入光标旁边。
 *
 * <p>开关是本地设置，默认关。光标位置来自编辑器的 `CursorAnchorInfo`（`InputConnection.requestCursorUpdates`）：编辑器拒绝报告时整个输入框照旧停在底部；刚要过位置、还在等第一次报告时（最多 {@link #ANCHOR_WAIT_MS}），候选栏先不显示；答应了却在要显示候选栏时等不来位置，这一次停在底部，等空闲时收到位置再回到光标旁，不在打字途中跳走。几何按输入法窗口的坐标算：先放在光标下方，靠近底边放不下时翻到光标上方，水平方向与光标（组字起点）左对齐，总是夹在系统栏之间的区域里。这里只做判断和换算，不依赖 Android 运行时，供 JVM 冒烟直接调用。
 */
public final class CaretCandidatePolicy {
    /** 候选栏与光标所在行之间的空隙（dp）。 */
    public static final int GAP_DP = 4;
    /** 要过光标位置后等第一次报告的时长（毫秒）。编辑器通常在下一帧就报来；实体键盘第一次按下时才要位置的话，那一下的组字要等它，等不到就退回底部。 */
    public static final long ANCHOR_WAIT_MS = 300;

    /** 空闲时收起窗口后，至少隔这么久（毫秒）才再收一次：有的应用一见键盘收起就要求再显示，不加间隔就会和它每帧来回打转。 */
    public static final long WINDOW_REHIDE_MS = 500;

    /** 发出空闲收起请求后多久（毫秒）之内落地的收起算作自己的：收起要等应用那边的键盘动画，模拟器上量到约半秒，应用同时要求显示时系统还会把一次收起分几次落地。过了这个时长就不再认，免得把之后用户按返回键收起键盘也当成自己的。 */
    public static final long HIDE_LANDING_MS = 2000;

    private CaretCandidatePolicy() { }

    /**
     * 此刻候选栏是否放在光标旁：开关打开、键区收起成候选条（没有占用键区的面板）、这个输入框答应报告光标位置，且这一次没有退回底部（{@link #docked}）。
     */
    public static boolean active(boolean enabled, boolean keysCollapsed, boolean anchorsReported,
            boolean docked) {
        return enabled && keysCollapsed && anchorsReported && !docked;
    }

    /**
     * 是否退回底部：已经退回的保持；跟随光标时要显示候选栏，而编辑器没报来光标位置、也不在等第一次报告，也退回。
     *
     * @param following 不看是否已退回时，候选栏本该跟随光标（{@link #active} 的前三个条件）
     * @param anchorPending 刚要过位置，还在 {@link #ANCHOR_WAIT_MS} 之内
     */
    public static boolean docked(boolean docked, boolean following, boolean stripShown, boolean anchorKnown,
            boolean anchorPending) {
        return docked || (following && stripShown && !anchorKnown && !anchorPending);
    }

    /** 键盘外框此刻是否显示：不跟随光标时照旧显示；跟随光标时只在候选栏有内容、且已知光标位置时显示（等第一次报告期间先不显示）。 */
    public static boolean surfaceShown(boolean following, boolean stripShown, boolean anchorKnown) {
        return !following || (stripShown && anchorKnown);
    }

    /**
     * 输入法窗口是否该收起：跟随光标且候选栏没有内容（空闲）时什么也不画，窗口却还开着的话，系统仍当键盘在显示，第一下返回键被拿去收起这个看不见的窗口，应用要按第二下才返回，导航栏也一直是收起键盘的样子。所以空闲时收起整个窗口，开始组字时再叫出来。等第一次报告位置期间候选栏有内容，不收起。
     */
    public static boolean hidesWindow(boolean following, boolean stripShown) {
        return following && !stripShown;
    }

    /** 距离上一次空闲收起窗口（{@code lastHiddenAt}，没有收起过时为 `Long.MIN_VALUE`）还要等多久（毫秒）才能再收；不用等时为 0。 */
    public static long rehideDelay(long lastHiddenAt, long now) {
        if (lastHiddenAt == Long.MIN_VALUE) return 0;
        return Math.max(0, lastHiddenAt + WINDOW_REHIDE_MS - now);
    }

    /** 此刻落地的收起是不是自己的空闲收起：这个输入框里发出过请求，且距最近一次请求没超过 {@link #HIDE_LANDING_MS}。 */
    public static boolean ownHide(boolean pending, long requestedAt, long now) {
        return pending && now - requestedAt <= HIDE_LANDING_MS;
    }

    /** 退回底部后收到光标位置：空闲（候选栏不显示）时回到光标旁；正在组字时保持在底部，免得候选栏在打字途中跳走、应用跟着重新排版。 */
    public static boolean dockedAfterAnchor(boolean docked, boolean stripShown) {
        return docked && stripShown;
    }

    /**
     * 候选栏左边的位置：与光标（组字起点）左对齐，夹在 {@code min} 到 {@code max - width} 之间；比可用宽度还宽时贴在 {@code min}。位置未知（不是有限数）时水平居中。
     */
    public static int x(float anchorLeft, int width, int min, int max) {
        int right = max - width;
        if (!Float.isFinite(anchorLeft)) return BoundsPolicy.atLeast(min + (max - min - width) / 2, min);
        return BoundsPolicy.bounded(Math.round(anchorLeft), min, right);
    }

    /**
     * 候选栏顶边的位置：放在光标所在行下方 {@code gap} 处；下方放不下而上方放得下时翻到光标上方；两边都放不下时放在空间大的一侧，并夹在 {@code min} 到 {@code max - height} 之间。位置未知（不是有限数）时贴在底边。
     */
    public static int y(float anchorTop, float anchorBottom, int height, int min, int max, int gap) {
        int lowest = max - height;
        if (!Float.isFinite(anchorTop) || !Float.isFinite(anchorBottom)) return BoundsPolicy.atLeast(lowest, min);
        int below = Math.round(anchorBottom) + gap;
        if (below <= lowest) return BoundsPolicy.atLeast(below, min);
        int above = Math.round(anchorTop) - gap - height;
        if (above >= min && above <= lowest) return above;
        boolean moreRoomBelow = max - anchorBottom >= anchorTop - min;
        return BoundsPolicy.bounded(moreRoomBelow ? below : above, min, lowest);
    }
}
