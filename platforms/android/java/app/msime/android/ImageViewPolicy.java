package app.msime.android;

import android.content.res.ColorStateList;
import android.content.Context;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.widget.ImageView;
import androidx.annotation.DrawableRes;
import androidx.annotation.ColorInt;

/** Android 图片控件共用的状态与外观策略。 */
public final class ImageViewPolicy {
    private ImageViewPolicy() {}

    /** 通过平台颜色状态列表为图片应用单色着色。 */
    public static void setTint(ImageView view, @ColorInt int color) {
        view.setImageTintList(ColorStateList.valueOf(color));
    }

    /** Create an accessibility-hidden decorative image with a theme tint. */
    public static ImageView decorative(Context context, @DrawableRes int icon,
                                       @ColorInt int tint) {
        ImageView view = decorative(context, icon);
        setTint(view, tint);
        return view;
    }

    /** Create an accessibility-hidden decorative image from a resource. */
    public static ImageView decorative(Context context, @DrawableRes int icon) {
        ImageView view = new ImageView(context);
        view.setImageResource(icon);
        hideFromAccessibility(view);
        return view;
    }

    /** Create an accessibility-hidden decorative image from a runtime drawable. */
    public static ImageView decorative(Context context, Drawable icon) {
        ImageView view = new ImageView(context);
        view.setImageDrawable(icon);
        hideFromAccessibility(view);
        return view;
    }

    /** Create a square icon button from a drawable resource. */
    public static ImageView iconButton(Context context, @DrawableRes int icon,
                                       @ColorInt int tint, CharSequence description,
                                       float sizeDp, Runnable action) {
        return iconButton(context, context.getDrawable(icon), tint, description, sizeDp, action);
    }

    /** Create a square icon button with a theme ripple and accessible tap target. */
    public static ImageView iconButton(Context context, Drawable icon,
                                       @ColorInt int tint, CharSequence description,
                                       float sizeDp, Runnable action) {
        ImageView button = new ImageView(context);
        button.setImageDrawable(icon);
        setTint(button, tint);
        button.setScaleType(ImageView.ScaleType.CENTER);
        ViewPolicy.setBackground(button, ViewPolicy.ripple(context));
        button.setContentDescription(description);
        ViewPolicy.setInteractive(button, true);
        ViewPolicy.bindOptionalClick(button, action);
        int size = DimensionPolicy.pixels(context, sizeDp);
        button.setLayoutParams(ViewPolicy.newSquareParamsPx(size));
        ViewPolicy.setSymmetricPadding(button, size / 5, size / 5);
        return button;
    }

    /** Create the muted, accessibility-hidden chevron used by navigable rows. */
    public static ImageView chevron(Context context, @ColorInt int tint) {
        ImageView view = decorative(context, app.msime.android.R.drawable.ms_w1_a2_chevron, tint);
        return view;
    }

    private static void hideFromAccessibility(View view) {
        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    }
}
