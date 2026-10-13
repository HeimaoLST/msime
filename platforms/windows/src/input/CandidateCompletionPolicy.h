#pragma once

#include <cstdint>

namespace msime::windows {

// Shared Engine CandidateSource values. These sources represent complete
// results in the Windows server; database/UserDatabase and AI candidates may
// still consume only part of the pinyin composition.
constexpr bool candidate_finishes_composition(uint8_t source) noexcept {
  return source == 2u ||  // CloudSuggestion
         source == 4u ||  // EnglishDictionary
         source == 5u ||  // QuickPhrase
         source == 6u ||  // Emoji
         source == 7u ||  // Kaomoji
         source == 8u ||  // Generated sentence
         source == 13u || // MixedJapanese: 日文混输行和英文一样整段上屏，引擎选中它就结束组字
         // Plugin：脚本插件在 `/` 指令里给的行。本地模式里选中时引擎重置组字，这次结果是整段上屏而不是暂存一段，不加它也照常出声画特效；加上是让策略表和引擎「选中即整段上屏」的语义一致，理由同来源 8。
         source == 14u;
}

} // namespace msime::windows
