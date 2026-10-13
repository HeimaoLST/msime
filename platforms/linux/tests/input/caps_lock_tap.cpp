// 单按 Caps Lock 切换中英文：两个 Linux 宿主共用的判定规则（shared/input/CapsLockTap.h），以及只在 X11 会话里撤回大写锁定的那道关口。没有 X11 支持编进来时撤不回，宿主就不布防，Caps Lock 照常。
#include "system/CapsLockRelease.h"
#include "../../../../shared/input/CapsLockTap.h"
#include <stdexcept>

void require(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}

int main() {
  using msime::input::CapsLockTap;
  using msime::linux_host::caps_lock_release_supported;

  CapsLockTap tap;
  tap.press(1000, true, false, false);
  require(tap.release(1300), "a release within 300 ms is a tap");
  tap.press(2000, true, false, false);
  require(!tap.release(2301), "a longer press keeps Caps Lock");
  tap.press(3000, true, true, false);
  require(!tap.release(3010), "pressing Caps Lock while it is on only turns it off");
  tap.press(4000, true, false, true);
  require(!tap.release(4010), "Caps Lock with a modifier held is a chord");
  tap.press(5000, true, false, false);
  tap.interrupt();
  require(!tap.release(5010), "typing while Caps Lock is held uses the lock");
  tap.press(6000, false, false, false);
  require(!tap.release(6010), "the switch off leaves Caps Lock alone");

  require(caps_lock_release_supported(nullptr, "x11", ":0"), "an X11 session can release the lock");
  require(caps_lock_release_supported("", nullptr, ":1"), "an empty WAYLAND_DISPLAY is not a Wayland session");
  require(!caps_lock_release_supported("wayland-0", "wayland", ":0"),
          "XWayland's DISPLAY does not reach the compositor's lock");
  require(!caps_lock_release_supported(nullptr, "wayland", ":0"), "XDG_SESSION_TYPE=wayland is a Wayland session");
  require(!caps_lock_release_supported(nullptr, nullptr, nullptr), "no display, nothing to release");
  require(!caps_lock_release_supported(nullptr, "x11", ""), "an empty DISPLAY is no display");
  return 0;
}
