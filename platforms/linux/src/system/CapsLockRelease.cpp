#include "CapsLockRelease.h"

#include <cstdlib>

// X11 的头文件定义 None、Bool、Status 这类宏，单独放在这个文件里，不让它们流进 IBus 与 Fcitx5 的宿主代码。
#ifdef MSIME_LINUX_HAS_X11_SURFACE
#include <X11/XKBlib.h>
#include <X11/Xlib.h>
#endif

namespace msime::linux_host {

namespace {
bool (*available_for_testing)() = nullptr;
bool (*release_for_testing)() = nullptr;
} // namespace

void replace_caps_lock_release_for_testing(bool (*available)(), bool (*release)()) {
  available_for_testing = available;
  release_for_testing = release;
}

bool caps_lock_release_available() {
  if (available_for_testing) return available_for_testing();
#ifdef MSIME_LINUX_HAS_X11_SURFACE
  return caps_lock_release_supported(std::getenv("WAYLAND_DISPLAY"), std::getenv("XDG_SESSION_TYPE"),
                                     std::getenv("DISPLAY"));
#else
  return false;
#endif
}

bool release_caps_lock() {
  if (release_for_testing) return release_for_testing();
#ifdef MSIME_LINUX_HAS_X11_SURFACE
  if (!caps_lock_release_available()) return false;
  Display *display = XOpenDisplay(nullptr);
  if (!display) return false;
  // 只清掉锁定的 Lock 位，其他锁定（Num Lock 等）不动。
  const bool released = XkbLockModifiers(display, XkbUseCoreKbd, LockMask, 0) == True;
  XSync(display, False);
  XCloseDisplay(display);
  return released;
#else
  return false;
#endif
}

} // namespace msime::linux_host
