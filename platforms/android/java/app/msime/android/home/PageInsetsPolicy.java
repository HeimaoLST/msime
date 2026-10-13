package app.msime.android.home;

import app.msime.android.DimensionPolicy;
import app.msime.android.ViewPolicy;
import app.msime.android.WindowInsetsPolicy;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Shared page bottom-inset binding for home screens. */
public final class PageInsetsPolicy {
    private PageInsetsPolicy() {}

    /** Keep page content above system bars, the tab bar, and the IME. */
    public static void bind(View view) {
        android.content.Context context = view.getContext();
        int base = DimensionPolicy.pixels(context, Ui.PAGE_PADDING_BOTTOM);
        int tabs = DimensionPolicy.pixels(context, Ui.TAB_BAR_HEIGHT);
        ViewCompat.setOnApplyWindowInsetsListener(view, (target, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int bottom = WindowInsetsPolicy.bottomContentInset(bars.bottom, tabs, ime.bottom, base);
            ViewPolicy.setBottomPadding(target, bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(view);
    }
}
