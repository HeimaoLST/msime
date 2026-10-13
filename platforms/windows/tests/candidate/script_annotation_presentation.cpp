// 脚本插件的注释（view 候选的 script_annotation）进候选窗的投影：和引擎的 annotation 分开放，五笔剩余编码、韩文汉字的 훈음 都不动它；注释那一段是引擎注释在前、插件注释隔一个空格在后，两段加起来超过候选窗能画的长度时只留引擎注释。
#include "CandidatePresentation.h"
#include <iostream>
#include <stdexcept>
#include <string>

using namespace msime::windows;
namespace {
[[noreturn]] void require_failed(int line) {
  throw std::runtime_error("Script annotation presentation test failed at line " + std::to_string(line));
}
#define require(value)                                                         \
  do {                                                                         \
    if (!(value))                                                              \
      require_failed(__LINE__);                                                \
  } while (false)
nlohmann::json candidate(size_t index, const std::string &text, const std::string &code,
                         const std::string &annotation) {
  return nlohmann::json{{"id", {{"session", 1}, {"generation", 2}, {"index", index}}},
                        {"text", text},
                        {"highlighted", index == 0},
                        {"code", code},
                        {"annotation", annotation},
                        {"translation", ""}};
}
// 全拼的一页：第一行插件和引擎都有注释，第二行只有插件的，第三行没有插件注释（键不出现，和没有插件时的 JSON 一样）。
nlohmann::json pinyin_view() {
  auto first = candidate(0, "你好", "nihao", "ni");
  first["script_annotation"] = "问候";
  auto second = candidate(1, "拟好", "nihao", "");
  second["script_annotation"] = "常用";
  return nlohmann::json{{"session", 1},
                        {"generation", 2},
                        {"focused", true},
                        {"scheme", 0},
                        {"local_mode", "none"},
                        {"preedit", "nihao"},
                        {"editing_text", "nihao"},
                        {"candidates", {first, second, candidate(2, "你号", "nihao", "hao")}}};
}
} // namespace
int main() {
  try {
    const FocusLease lease{{42, {1, 2, 3}}, 1, 1};
    const auto projected = candidate_presentation_from_view(lease, pinyin_view(), 0, 0, "");
    require(projected.visible && projected.candidates.size() == 3);
    // 插件的注释另放一格，引擎的注释原样留着。
    const auto &hello = projected.candidates[0];
    require(hello.annotation == "ni" && hello.script_annotation == "问候");
    require(projected.candidates[1].annotation.empty() && projected.candidates[1].script_annotation == "常用");
    require(projected.candidates[2].annotation == "hao" && projected.candidates[2].script_annotation.empty());
    // 注释那一段：引擎注释在前，插件注释隔一个空格在后，起点指着插件注释。
    const auto both = candidate_annotation_run(hello);
    require(both.text == "ni 问候" && both.script_start == 3);
    const auto only_script = candidate_annotation_run(projected.candidates[1]);
    require(only_script.text == "常用" && only_script.script_start == 0);
    const auto only_engine = candidate_annotation_run(projected.candidates[2]);
    require(only_engine.text == "hao" && only_engine.script_start == std::string::npos);
    // 繁体输出只转候选文字，插件的注释是插件自己的文本，不转。
    const auto traditional = candidate_presentation_from_view(lease, pinyin_view(), 0, 0, "", true);
    require(traditional.candidates[0].script_annotation == "问候");
    // 释义和悬停提示不带插件的注释。
    require(candidate_secondary_text(hello).empty() && candidate_tooltip_text(hello) == "你好");

    // 送达按键时的投影（Server 画候选窗用的那一条）读同一个键。
    PendingReply reply{};
    reply.source = {42, 1, 7, false, nlohmann::json{{"commit", nullptr}, {"view", pinyin_view()}}};
    FanyImeNamedpipeData packet{};
    packet.client_id = 42;
    packet.request_id = 7;
    packet.event_type = FanyImePipeEventType::KeyEvent;
    const auto delivered = candidate_presentation(lease, reply, packet);
    require(delivered.candidates[0].annotation == "ni" && delivered.candidates[0].script_annotation == "问候");
    require(delivered.candidates[2].script_annotation.empty());

    // 五笔剩余编码换掉的是引擎的注释，插件的注释照样跟在后面。
    auto wubi = pinyin_view();
    wubi["scheme"] = 2;
    wubi["preedit"] = "wq";
    wubi["editing_text"] = "wq";
    wubi["candidates"] = {candidate(0, "你", "wqiy", "")};
    wubi["candidates"][0]["script_annotation"] = "常用";
    const auto hinted = with_wubi_code_hints(candidate_presentation_from_view(lease, wubi, 0, 0, ""), true);
    require(hinted.candidates[0].annotation == "(iy)" && hinted.candidates[0].script_annotation == "常用");
    const auto hinted_run = candidate_annotation_run(hinted.candidates[0]);
    require(hinted_run.text == "(iy) 常用" && hinted_run.script_start == 5);

    // 韩文汉字的 훈음 从注释挪到释义一行，插件的注释留在注释那一段。
    auto hanja = pinyin_view();
    hanja["scheme"] = 4;
    hanja["dedicated_english"] = false;
    hanja["preedit"] = "한";
    hanja["editing_text"] = "gks";
    hanja["candidates"] = {candidate(0, "韓", "gks", "나라 이름 한")};
    hanja["candidates"][0]["script_annotation"] = "常用";
    const auto korean = candidate_presentation_from_view(lease, hanja, 0, 0, "");
    require(korean.candidates[0].annotation.empty() && korean.candidates[0].gloss == "나라 이름 한");
    require(korean.candidates[0].script_annotation == "常用");
    require(candidate_annotation_run(korean.candidates[0]).text == "常用");

    // 两段连起来超过 4096 字节时只画引擎的注释，插件的注释不让这一段画不出来；正好 4096 时两段都画。
    PresentationCandidate crowded{};
    crowded.text = "长";
    crowded.annotation = std::string(4090, 'a');
    crowded.script_annotation = "常用";
    const auto dropped = candidate_annotation_run(crowded);
    require(dropped.text == crowded.annotation && dropped.script_start == std::string::npos);
    crowded.annotation = std::string(4089, 'a');
    const auto fitted = candidate_annotation_run(crowded);
    require(fitted.text.size() == 4096 && fitted.script_start == 4090);

    // 和别的字段一样，超过 4096 字节的插件注释让整个投影作废，不画半截。
    auto oversized = pinyin_view();
    oversized["candidates"][0]["script_annotation"] = std::string(4097, 'x');
    bool rejected = false;
    try {
      (void)candidate_presentation_from_view(lease, oversized, 0, 0, "");
    } catch (const std::invalid_argument &) {
      rejected = true;
    }
    require(rejected);
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
  std::cout << "Script annotation presentation checks passed\n";
  return 0;
}
