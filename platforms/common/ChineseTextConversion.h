#pragma once

#include "HostApiString.h"

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace msime::host_api {

inline std::optional<std::string> simplified_to_traditional(std::string_view text) {
  auto converted = own_string(msime_client_simplified_to_traditional(
      reinterpret_cast<const uint8_t *>(text.data()), text.size()));
  if (!converted)
    return std::nullopt;
  return std::string(converted.get());
}

// 偏好 `traditional_chinese_variant` 的取值换成 `msime_client_convert_to_traditional` 的编号；缺省或认不出的值按 s2t，与 client-core 的默认一致。
inline uint32_t traditional_variant_code(std::string_view name) {
  if (name == "s2tw")
    return 1;
  if (name == "s2twp")
    return 2;
  return 0;
}

inline std::optional<std::string> convert_to_traditional(std::string_view text, uint32_t variant) {
  auto converted = own_string(msime_client_convert_to_traditional(
      reinterpret_cast<const uint8_t *>(text.data()), text.size(), variant));
  if (!converted)
    return std::nullopt;
  return std::string(converted.get());
}

} // namespace msime::host_api
