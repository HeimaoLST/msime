#include <cassert>
#include "../../src/core/PairedPunctuation.h"

int main() {
  msime::mac::PairedPunctuationTracker tracker;
  tracker.push("）");
  tracker.push("】");
  assert(tracker.size() == 2);
  assert(!msime::mac::paired_closing_should_skip(tracker, "】", "】", true, 1, 1, 2, 4));
  assert(tracker.size() == 2);
  assert(msime::mac::paired_closing_should_skip(tracker, "】", "】", true, 0, 1, 2, 4));
  assert(tracker.size() == 1);
  assert(!msime::mac::paired_closing_should_skip(tracker, "）", "", false, 0, 1, 2, 4));
  assert(tracker.empty());

  // 引号和方头括号的两组字：栈顶是哪一组的后半个，这个键就跨过哪一个。
  assert(msime::mac::paired_closing_for_key('"', false, tracker) == "”");
  assert(msime::mac::paired_closing_for_key('\'', false, tracker) == "’");
  assert(msime::mac::paired_closing_for_key(']', false, tracker) == "】");
  assert(msime::mac::paired_closing_for_key('}', true, tracker) == "｝");
  assert(!msime::mac::paired_closing_for_key(',', false, tracker));
  tracker.push("」");
  assert(msime::mac::paired_closing_for_key('\'', false, tracker) == "」");
  assert(msime::mac::paired_closing_for_key('"', false, tracker) == "”");
  tracker.push("〗");
  assert(msime::mac::paired_closing_for_key(']', false, tracker) == "〗");
  assert(msime::mac::paired_closing_should_skip(tracker, "〗", "〗", true, 0, 1, 2, 4));
  tracker.push("』");
  assert(msime::mac::paired_closing_for_key('"', false, tracker) == "』");
  assert(msime::mac::paired_closing_should_skip(tracker, "』", "』", true, 0, 1, 2, 4));
  assert(msime::mac::paired_closing_should_skip(tracker, "」", "」", true, 0, 1, 2, 4));
  assert(tracker.empty());
}
