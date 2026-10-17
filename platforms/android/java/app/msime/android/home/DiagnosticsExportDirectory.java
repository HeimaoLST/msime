package app.msime.android.home;

import app.msime.android.ExportDirectory;
import android.content.Context;
import android.net.Uri;
import app.msime.android.AndroidLocalSettings;
import java.io.File;
import java.io.IOException;

/** 诊断目录继续使用独立设置，授权与安全写入复用公共目录适配器。 */
final class DiagnosticsExportDirectory {
    private DiagnosticsExportDirectory() {}

    static String saved(Context context) {
        return ExportDirectory.saved(context, AndroidLocalSettings.DIAGNOSTICS_EXPORT_TREE);
    }

    static ExportDirectory.Directory inspect(Context context, String value) throws IOException {
        return ExportDirectory.inspect(context, value);
    }

    static ExportDirectory.Directory remember(Context context, Uri selected, int flags) throws IOException {
        return ExportDirectory.remember(context, AndroidLocalSettings.DIAGNOSTICS_EXPORT_TREE, selected, flags);
    }

    static String write(Context context, String selected, File archive) throws IOException {
        return ExportDirectory.write(context, selected, archive, "application/zip");
    }
}
