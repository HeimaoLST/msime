#pragma once

#include <cstddef>
#include <string>
#include <string_view>
#include <vector>
#include <optional>

namespace msime::mac {

// Tracks only closing marks inserted by this host, so a later key can skip
// one without consuming text that belonged to the document already.
class PairedPunctuationTracker {
 public:
  static constexpr std::size_t kMaxDepth = 16;

  void clear() { closings_.clear(); }
  bool empty() const { return closings_.empty(); }
  std::size_t size() const { return closings_.size(); }

  void push(std::string closing) {
    if (closing.empty()) return;
    if (closings_.size() == kMaxDepth) closings_.erase(closings_.begin());
    closings_.push_back(std::move(closing));
  }

  bool matches(std::string_view closing) const {
    return !closings_.empty() && closings_.back() == closing;
  }

  bool consume(std::string_view closing, std::string_view following,
               bool followingKnown, bool modifiersAllowed = true) {
    if (!modifiersAllowed || closings_.empty() || closings_.back() != closing) return false;
    if (!followingKnown || following != closing) { clear(); return false; }
    closings_.pop_back();
    return true;
  }

 private:
  std::vector<std::string> closings_;
};

// 这个键能跨过的后半个。引号和方头括号有两组字（quote_style、bracket_style），样式可能在一对还开着时换掉，所以按 tracker 栈顶挑：栈顶是其中之一就给它，否则给缺省那个。
inline std::optional<std::string> paired_closing_for_key(char key, bool fullwidth,
                                                         const PairedPunctuationTracker &tracker) {
  const auto either = [&tracker](const char *first, const char *second) -> std::string {
    return tracker.matches(second) ? second : first;
  };
  switch (key) {
    case '"': return either("”", "』");
    case '\'': return either("’", "」");
    case ')': return std::string("）");
    case ']': return either("】", "〗");
    case '}': return fullwidth ? std::string("｝") : std::string("}");
    case '>': return std::string("〉");
    default: return std::nullopt;
  }
}

inline bool paired_closing_modifiers_allowed(unsigned long long flags,
                                             unsigned long long control,
                                             unsigned long long option,
                                             unsigned long long command) {
  return (flags & (control | option | command)) == 0;
}

inline bool paired_closing_should_skip(PairedPunctuationTracker &tracker,
                                       std::string_view closing,
                                       std::string_view following,
                                       bool followingKnown,
                                       unsigned long long flags,
                                       unsigned long long control,
                                       unsigned long long option,
                                       unsigned long long command) {
  return tracker.consume(closing, following, followingKnown,
                         paired_closing_modifiers_allowed(flags, control, option, command));
}

}  // namespace msime::mac
