package app.msime.android.test;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;

/** 合成编辑器放进剪贴板的那张图片的来源（#6781）：只读地提供 {@link EditorActivity#syntheticImage} 这一个文件，类型是 PNG。不导出，靠剪贴板授给当前输入法读权限，和真实应用「复制图片」的路径一样。 */
public final class ImageClipProvider extends ContentProvider {
    static final String AUTHORITY = "app.msime.android.test.images";

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) { return "image/png"; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = EditorActivity.syntheticImage(getContext());
        if (!"r".equals(mode) || !file.getName().equals(uri.getLastPathSegment()))
            throw new FileNotFoundException("synthetic image only");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }

    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }

    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
