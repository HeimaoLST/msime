#pragma once
#import <AppKit/AppKit.h>
#import "../candidate/CandidateWindowLevel.h"

// 屏幕键盘在截图遮罩上方、候选窗下方；窗口与内容层共同保留透明圆角。
inline void MSIMEConfigureScreenKeyboardWindow(NSWindow *window) {
    window.opaque = NO;
    window.backgroundColor = NSColor.clearColor;
    window.level = MSIMECandidateWindowLevel() - 1;
    NSView *content = window.contentView;
    content.wantsLayer = YES;
    content.layer.cornerRadius = 8;
    content.layer.masksToBounds = YES;
    [window invalidateShadow];
}
