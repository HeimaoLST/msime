package app.msime.android.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.ContextThemeWrapper;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;

/** 在安装产品的真实分页网格上分发稀疏触摸，检查接手时位移、边界和子控件取消。 */
public final class PagedTileGridGestureDeviceSmoke extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }

    @Override public void onStart() {
        Throwable[] failure = new Throwable[1];
        runOnMainSync(() -> {
            try { checkGestures(); }
            catch (ReflectiveOperationException | AssertionError | RuntimeException error) { failure[0] = error; }
        });
        Bundle result = new Bundle();
        if (failure[0] == null) {
            result.putString("stream", "MSIME_DEVICE_SMOKE_PASSED: paged grid keeps the first drag distance and child touch ownership\n");
            finish(Activity.RESULT_OK, result);
        } else {
            result.putString("stream", "MSIME_DEVICE_SMOKE_FAILED: paged grid gesture ("
                + failure[0].getClass().getSimpleName() + ")"
                + (failure[0] instanceof AssertionError ? " " + failure[0].getMessage() : "") + "\n");
            finish(Activity.RESULT_CANCELED, result);
        }
    }

    private void checkGestures() throws ReflectiveOperationException {
        Context context = new ContextThemeWrapper(getTargetContext(), android.R.style.Theme_Material_Light);
        Class<?> type = getTargetContext().getClassLoader().loadClass("app.msime.android.PagedTileGrid");
        for (int direction : new int[] {1, -1}) {
            ViewGroup grid = grid(context, type);
            int startPage = direction == 1 ? 0 : 1;
            type.getMethod("setPage", int.class, boolean.class).invoke(grid, startPage, false);
            float start = direction == 1 ? 875 : 125;
            float moved = start - direction * 625;
            long down = SystemClock.uptimeMillis();
            touch(grid, down, 0, MotionEvent.ACTION_DOWN, start, 50);
            touch(grid, down, 1000, MotionEvent.ACTION_MOVE, moved, 50);
            check(grid.getScrollX() == startPage * 1000 + direction * 625,
                "first intercepted movement was lost: direction=" + direction + " scroll=" + grid.getScrollX());
            touch(grid, down, 2000, MotionEvent.ACTION_MOVE, moved - direction * 50, 50);
            check(grid.getScrollX() == startPage * 1000 + direction * 675,
                "following movement repeated the intercepted distance");
            touch(grid, down, 3000, MotionEvent.ACTION_UP, moved - direction * 50, 50);
            check((Integer) type.getMethod("page").invoke(grid) == 1 - startPage,
                "slow sparse drag did not settle on the next page");
            check(cancels(grid) == 1 && releases(grid) == 0,
                "horizontal drag did not cancel exactly one child press");
        }
        ViewGroup grid = grid(context, type);
        long down = SystemClock.uptimeMillis();
        touch(grid, down, 0, MotionEvent.ACTION_DOWN, 875, 50);
        touch(grid, down, 1000, MotionEvent.ACTION_MOVE, -500, 50);
        check(grid.getScrollX() == 1000, "drag escaped the last page");
        touch(grid, down, 2000, MotionEvent.ACTION_MOVE, -400, 50);
        check(grid.getScrollX() == 900, "return from boundary used a stale touch position");
        touch(grid, down, 3000, MotionEvent.ACTION_CANCEL, -400, 50);
        grid = grid(context, type);
        touch(grid, down, 0, MotionEvent.ACTION_DOWN, 125, 50);
        touch(grid, down, 1000, MotionEvent.ACTION_MOVE, 1500, 50);
        check(grid.getScrollX() == 0, "drag escaped the first page");
        touch(grid, down, 2000, MotionEvent.ACTION_CANCEL, 1500, 50);
        grid = grid(context, type);
        touch(grid, down, 0, MotionEvent.ACTION_DOWN, 125, 50);
        touch(grid, down, 50, MotionEvent.ACTION_UP, 125, 50);
        check(releases(grid) == 1 && cancels(grid) == 0 && grid.getScrollX() == 0,
            "tap stopped reaching the child");
        grid = grid(context, type);
        touch(grid, down, 0, MotionEvent.ACTION_DOWN, 125, 50);
        touch(grid, down, 1000, MotionEvent.ACTION_MOVE, 130, 100);
        touch(grid, down, 2000, MotionEvent.ACTION_UP, 130, 100);
        check(releases(grid) == 1 && cancels(grid) == 0 && grid.getScrollX() == 0,
            "vertical movement was intercepted as a page drag");
    }

    private static ViewGroup grid(Context context, Class<?> type) throws ReflectiveOperationException {
        ViewGroup grid = (ViewGroup) type.getConstructor(Context.class).newInstance(context);
        type.getMethod("setGrid", int.class, int.class).invoke(grid, 4, 3);
        for (int index = 0; index < 24; index++) grid.addView(new TouchButton(context));
        FrameLayout parent = new FrameLayout(context);
        parent.addView(grid, new FrameLayout.LayoutParams(1000, 700));
        parent.measure(View.MeasureSpec.makeMeasureSpec(1000, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(700, View.MeasureSpec.EXACTLY));
        parent.layout(0, 0, 1000, 700);
        return grid;
    }

    private static void touch(View grid, long down, long offset, int action, float x, float y) {
        MotionEvent event = MotionEvent.obtain(down, down + offset, action, x, y, 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try { check(grid.dispatchTouchEvent(event), "grid rejected the touch sequence"); }
        finally { event.recycle(); }
    }

    private static int cancels(ViewGroup grid) {
        int count = 0;
        for (int index = 0; index < grid.getChildCount(); index++) count += ((TouchButton) grid.getChildAt(index)).cancels;
        return count;
    }

    private static int releases(ViewGroup grid) {
        int count = 0;
        for (int index = 0; index < grid.getChildCount(); index++) count += ((TouchButton) grid.getChildAt(index)).releases;
        return count;
    }

    private static final class TouchButton extends Button {
        int cancels;
        int releases;
        TouchButton(Context context) { super(context); setOnClickListener(ignored -> { }); }
        @Override public boolean onTouchEvent(MotionEvent event) {
            if (event.getActionMasked() == MotionEvent.ACTION_CANCEL) cancels++;
            if (event.getActionMasked() == MotionEvent.ACTION_UP) releases++;
            return super.onTouchEvent(event);
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
