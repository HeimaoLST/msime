#include "../../Global/CandidatePunctuationKeyPolicy.h"
#include "../../Global/PairedPunctuationHostPolicy.h"
#include <cstdio>
#include <cstdlib>
#include <string_view>

namespace {
int failures = 0;

void check(bool condition, const char *what) {
    if (!condition) {
        std::fprintf(stderr, "FAIL: %s\n", what);
        ++failures;
    }
}
} // namespace

int main() {
    using namespace Global;

    // Step-over: only a single closing half of an auto-completed pair qualifies.
    check(PairedPunctuationStepOverCandidate(L')', L"）") == L'）', "full-width paren closes");
    check(PairedPunctuationStepOverCandidate(L']', L"】") == L'】', "lenticular bracket closes");
    check(PairedPunctuationStepOverCandidate(L'>', L"》") == L'》', "book title mark closes");
    check(PairedPunctuationStepOverCandidate(L'}', L"}") == L'}', "brace closes");
    check(PairedPunctuationStepOverCandidate(L'"', L"“") == L'”', "double quote is keyed, not resolved");
    check(PairedPunctuationStepOverCandidate(L'"', L"”") == L'”', "double quote right half");
    check(PairedPunctuationStepOverCandidate(L'\'', L"‘") == L'’', "single quote is keyed, not resolved");
    check(PairedPunctuationStepOverCandidate(L'.', L"。") == 0, "full stop never steps over");
    check(PairedPunctuationStepOverCandidate(L':', L"：") == 0, "colon never steps over");
    check(PairedPunctuationStepOverCandidate(L'.', L".") == 0, "ascii dot never steps over");
    check(PairedPunctuationStepOverCandidate(L'(', L"（") == 0, "opening half never steps over");
    check(PairedPunctuationStepOverCandidate(L'^', L"……") == 0, "multi-character output never steps over");
    check(PairedPunctuationStepOverCandidate(L')', L"") == 0, "empty output never steps over");
    check(PairedPunctuationStepOverCandidate(L'}', L"}", true) == L'｝', "full-width brace pair is stepped over by its full-width half");
    check(PairedPunctuationStepOverCandidate(L'}', L"}", false) == L'}', "half-width brace pair keeps its ASCII half");
    check(PairedPunctuationStepOverCandidate(L')', L"）", true) == L'）', "full width changes only the brace");
    check(PairedPunctuationStepOverCandidate(L'x', L"」") == L'」', "corner bracket closing half steps over");
    // 直角引号与空心括号（quote_style、bracket_style）：引号键看出的是哪一组，后半个就是那一组的。
    check(PairedPunctuationStepOverCandidate(L'"', L"『") == L'』', "corner double quote is keyed to its own group");
    check(PairedPunctuationStepOverCandidate(L'"', L"』") == L'』', "corner double quote right half");
    check(PairedPunctuationStepOverCandidate(L'\'', L"「") == L'」', "corner single quote is keyed to its own group");
    check(PairedPunctuationStepOverCandidate(L']', L"〗") == L'〗', "hollow bracket closes");
    check(PairedPunctuationStepOverCandidate(L'[', L"〖") == 0, "hollow opening never steps over");

    // GetPunctuation 查表后的换字：只换引号和方头括号，其余原样。
    check(std::wstring_view(StyledPunctuation(L"“", true, false)) == L"『", "corner left double quote");
    check(std::wstring_view(StyledPunctuation(L"”", true, false)) == L"』", "corner right double quote");
    check(std::wstring_view(StyledPunctuation(L"‘", true, false)) == L"「", "corner left single quote");
    check(std::wstring_view(StyledPunctuation(L"’", true, false)) == L"」", "corner right single quote");
    check(std::wstring_view(StyledPunctuation(L"【", false, true)) == L"〖", "hollow left bracket");
    check(std::wstring_view(StyledPunctuation(L"】", false, true)) == L"〗", "hollow right bracket");
    check(std::wstring_view(StyledPunctuation(L"【", true, false)) == L"【", "corner quotes leave brackets alone");
    check(std::wstring_view(StyledPunctuation(L"“", false, true)) == L"“", "hollow brackets leave quotes alone");
    check(std::wstring_view(StyledPunctuation(L"……", true, true)) == L"……", "multi-character marks are untouched");
    check(std::wstring_view(StyledPunctuation(L"，", true, true)) == L"，", "other marks are untouched");
    check(StyledPunctuation(nullptr, true, true) == nullptr, "a missing mark stays missing");

    // 成对模式下引号键的后半个改回同一组的前半个。
    check(ReopenedPairedQuote(L'"', L'”') == L'“', "curly double quote reopens");
    check(ReopenedPairedQuote(L'\'', L'’') == L'‘', "curly single quote reopens");
    check(ReopenedPairedQuote(L'"', L'』') == L'『', "corner double quote reopens");
    check(ReopenedPairedQuote(L'\'', L'」') == L'「', "corner single quote reopens");
    check(ReopenedPairedQuote(L'"', L'』') != L'「', "the group follows the key");
    check(ReopenedPairedQuote(L'\'', L'』') == L'』', "another key's half is left alone");
    check(ReopenedPairedQuote(L'(', L'）') == L'）', "non-quote keys are left alone");

    // 成对表：与 macOS 的 MSIMEPunctuationPairs 一致，另含按键才补的 {} 与全角 ｛｝。
    check(PairedPunctuationClosingFor(L'（') == L'）', "paren pair");
    check(PairedPunctuationClosingFor(L'「') == L'」', "corner bracket pair");
    check(PairedPunctuationClosingFor(L'｛') == L'｝', "full-width brace pair");
    check(PairedPunctuationClosingFor(L'{') == L'}', "ascii brace pair");
    check(PairedPunctuationClosingFor(L'“') == L'”', "double quote pair");
    check(PairedPunctuationClosingFor(L'『') == L'』', "corner double quote pair");
    check(PairedPunctuationClosingFor(L'〖') == L'〗', "hollow bracket pair");
    check(PairedPunctuationClosingForCandidate(L"『") == L'』', "corner double quote candidate opens a pair");
    check(PairedPunctuationClosingFor(L'。') == 0, "full stop is not an opening");
    check(PairedPunctuationClosingFor(L'）') == 0, "closing half is not an opening");

    // 候选上屏只在整条文字恰好是一个左半边时补全，花括号只由按键补全。
    check(PairedPunctuationClosingForCandidate(L"「") == L'」', "corner bracket candidate opens a pair");
    check(PairedPunctuationClosingForCandidate(L"《") == L'》', "book title candidate opens a pair");
    check(PairedPunctuationClosingForCandidate(L"‘") == L'’', "single quote candidate opens a pair");
    check(PairedPunctuationClosingForCandidate(L"{") == 0, "ascii brace candidate stays alone");
    check(PairedPunctuationClosingForCandidate(L"｛") == 0, "full-width brace candidate stays alone");
    check(PairedPunctuationClosingForCandidate(L"你好（") == 0, "a phrase ending in an opening mark stays as it is");
    check(PairedPunctuationClosingForCandidate(L"") == 0, "empty commit opens nothing");

    // 全角模式下 `{` 键开的是 ｛，其余按键与半角时不变。
    check(PairedPunctuationKeyOpening(L'{', L'{', true) == L'｛', "full-width brace key opens a full-width pair");
    check(PairedPunctuationKeyOpening(L'{', L'{', false) == L'{', "half-width brace key keeps the ASCII brace");
    check(PairedPunctuationKeyOpening(L'(', L'（', true) == L'（', "full width leaves other keys alone");

    // Candidate navigation keeps paging on the main-row -/= and Tab, but not on the numpad arithmetic keys.
    check(IsCandidateNavigationKeyBeforePunctuation(0xBD), "main-row minus pages");
    check(IsCandidateNavigationKeyBeforePunctuation(0xBB), "main-row equals pages");
    check(IsCandidateNavigationKeyBeforePunctuation(0x09), "tab navigates");
    check(IsCandidateNavigationKeyBeforePunctuation(0x21) && IsCandidateNavigationKeyBeforePunctuation(0x22), "page up/down navigate");
    check(IsCandidateNavigationKeyBeforePunctuation(0x24) && IsCandidateNavigationKeyBeforePunctuation(0x23), "home/end navigate");
    check(!IsCandidateNavigationKeyBeforePunctuation(0x6D), "numpad minus commits the candidate");
    check(!IsCandidateNavigationKeyBeforePunctuation(0x6B), "numpad plus commits the candidate");
    check(!IsCandidateNavigationKeyBeforePunctuation(0x6E), "numpad decimal commits the candidate");
    check(!IsCandidateNavigationKeyBeforePunctuation(0x6F), "numpad divide commits the candidate");
    check(!IsCandidateNavigationKeyBeforePunctuation(0xBF), "slash commits the candidate");

    // The character appended after the committed candidate stays literal for the numpad keys and '/'.
    check(LiteralCandidatePunctuation(0x6B, L'+') == L'+', "numpad plus is literal");
    check(LiteralCandidatePunctuation(0x6D, L'-') == L'-', "numpad minus is literal");
    check(LiteralCandidatePunctuation(0x6E, L'.') == L'.', "numpad decimal is literal");
    check(LiteralCandidatePunctuation(0x6E, L',') == L'.', "numpad decimal is '.' whatever the layout reports");
    check(LiteralCandidatePunctuation(0x6F, L'/') == L'/', "numpad divide is literal");
    check(LiteralCandidatePunctuation(0xBF, L'/') == L'/', "main-row slash is literal");
    check(LiteralCandidatePunctuation(0xBC, L',') == 0, "comma is translated");
    check(LiteralCandidatePunctuation(0xBE, L'.') == 0, "main-row period is translated");
    check(LiteralCandidatePunctuation(0xBD, L'-') == 0, "main-row minus is not literal");

    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
