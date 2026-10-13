package app.msime.android.home;

import app.msime.android.LayoutPolicy;

import app.msime.android.DimensionPolicy;

import app.msime.android.ThemeColorPolicy;
import android.content.Context;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.Nullable;
import app.msime.android.ViewPolicy;

/** 选择面板共用的居中标题与可选副标题组件。 */
public final class SheetHeaderView {
    private SheetHeaderView() {}

    /** 创建带标准内边距、排版和无障碍标题语义的面板标题区。 */
    public static LinearLayout create(Context context, CharSequence title,
            @Nullable CharSequence subtitle) {
        LinearLayout header = LayoutPolicy.column(context);
        ViewPolicy.setCenteredHorizontally(header);
        int horizontal = DimensionPolicy.pixels(context, 16);
        ViewPolicy.setPadding(header, horizontal, 0, horizontal, DimensionPolicy.pixels(context, 12));

        TextView heading = ViewPolicy.headingLabel(context, title, Ui.TEXT_SHEET_HEADER, 600,
            ThemeColorPolicy.subText(context));
        ViewPolicy.setCentered(heading);
        header.addView(heading);

        if (subtitle != null && subtitle.length() > 0) {
            TextView note = ViewPolicy.centeredLabel(context, subtitle, Ui.TEXT_SHEET_HEADER, 400,
                ThemeColorPolicy.subText(context));
            LinearLayout.LayoutParams params = LayoutPolicy.wrapParams();
            params.topMargin = DimensionPolicy.pixels(context, 2);
            header.addView(note, params);
        }
        return header;
    }
}
