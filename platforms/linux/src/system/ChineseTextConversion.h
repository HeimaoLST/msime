#pragma once

#include <string>

#include <cstdint>

// 用 msime-host-api 导出的共享 OpenCC 词表把简体的显示和上屏文本转成繁体（词级转换，与 Windows 相同）。`variant` 是 `msime::host_api::traditional_variant_code` 的编号，缺省 0 即 s2t。没有繁体形式的文本原样返回；host API 拒收的文本（非法 UTF-8、内嵌 NUL）也原样返回。
std::string msime_linux_simplified_to_traditional(const std::string &text, uint32_t variant = 0);

// 偏好 `traditional_chinese_variant` 的编号，供宿主存进会话状态。
uint32_t msime_linux_traditional_variant(const std::string &name);
