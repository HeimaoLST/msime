#pragma once

#import <AppKit/AppKit.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *MSIMEInputModeHUDText(BOOL englishInputMode);
FOUNDATION_EXPORT BOOL MSIMEInputModeHUDUsableCaretRect(NSRect caretRect);
FOUNDATION_EXPORT NSRect MSIMEInputModeHUDFrame(NSRect caretRect, NSSize panelSize, NSRect visibleFrame);

/// A short, non-activating badge shown after the user switches Chinese/English input.
@interface MSIMEInputModeHUDPanel : NSPanel
+ (instancetype)sharedPanel;
- (void)showEnglishInputMode:(BOOL)englishInputMode nearCaretRect:(NSRect)caretRect;
/// The badge's fill, outline and glyph colour: the floating toolbar's, so it follows the selected theme and skin. Pass dynamic colours to follow the appearance. Until set, the system window colours.
- (void)setSurfaceColor:(NSColor *)surface borderColor:(NSColor *)border textColor:(NSColor *)text;
/// The light or dark mode the badge is drawn in. It wears the floating toolbar's palette, so it takes the toolbar's rule: `toolbar_theme` when it names a mode, otherwise `theme`, and the system appearance for `system` or neither. The controller passes the dictionary it gives the toolbar, whose `toolbar_theme` is pinned when the theme has a mode of its own.
- (void)applyThemePreferences:(NSDictionary *)preferences;
/// 紧凑提示独立使用 18pt 字号和 32pt 高度，图标遵循 `show_app_logo`；悬浮工具栏字号与缩放不影响它。
- (void)applySizingPreferences:(NSDictionary *)preferences;
@property(nonatomic, readonly) NSSize panelSize;
@property(nonatomic, readonly) NSColor *surfaceColor;
@property(nonatomic, readonly) NSColor *borderColor;
@property(nonatomic, readonly) NSColor *textColor;
@property(nonatomic, copy, readonly, nullable) NSString *displayedText;
@property(nonatomic, readonly) BOOL showsLogo;
@end

NS_ASSUME_NONNULL_END
