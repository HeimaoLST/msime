#include "ChineseTextConversion.h"

#include "../../../common/ChineseTextConversion.h"

#include <utility>

std::string msime_linux_simplified_to_traditional(const std::string &text, uint32_t variant) {
  if (text.empty())
    return text;
  // 共享的 OpenCC 词表，s2t 时与 Windows 的转换相同；NULL 表示非法 UTF-8 或内嵌 NUL，这时保留原文。
  auto converted = msime::host_api::convert_to_traditional(text, variant);
  return converted ? std::move(*converted) : text;
}

uint32_t msime_linux_traditional_variant(const std::string &name) {
  return msime::host_api::traditional_variant_code(name);
}
