#pragma once
#include <string_view>

namespace Global
{
// Match the executable basename, independently of the user's locale. Excel's
// cell editor interprets the completion's left arrow as cell navigation.
inline bool IsPairedPunctuationExcludedProcess(std::wstring_view processName)
{
    constexpr std::wstring_view excluded = L"excel.exe";
    if (processName.size() != excluded.size())
        return false;
    for (size_t i = 0; i < excluded.size(); ++i)
    {
        const wchar_t c = processName[i];
        const wchar_t lower = c >= L'A' && c <= L'Z' ? c + (L'a' - L'A') : c;
        if (lower != excluded[i])
            return false;
    }
    return true;
}

// 标点键补全时左半边对应的右半边，不成对时为 0。与 macOS 的 MSIMEPunctuationPairs 一致，另含 `{` 和全角模式下的 `｛`：macOS 只在按 `{` 键时补全这一对（全角时补成 ｛｝），不把恰好是 `{` 的符号候选当作开头，候选那一侧见 PairedPunctuationClosingForCandidate。
inline wchar_t PairedPunctuationClosingFor(wchar_t opening)
{
    switch (opening)
    {
    case L'“':
        return L'”';
    case L'‘':
        return L'’';
    case L'【':
        return L'】';
    case L'{':
        return L'}';
    case L'｛':
        return L'｝';
    case L'《':
        return L'》';
    case L'〈':
        return L'〉';
    case L'（':
        return L'）';
    case L'「':
        return L'」';
    // 引号样式、方头括号样式（quote_style、bracket_style）下 `"` 和 `[` 的另一组字。
    case L'『':
        return L'』';
    case L'〖':
        return L'〗';
    default:
        return 0;
    }
}

// 按 Server 推来的样式（`PunctuationMarksChanged` 帧）换掉 GetPunctuation 查表得到的字：直角引号下 “”‘’ 换成『』「」（按键对应：`'` 出「」，`"` 出『』），空心括号下【】换成〖〗。交替与嵌套状态仍由原表维护，这里只换字；其余标点原样返回。返回的都是静态字符串。
inline const wchar_t *StyledPunctuation(const wchar_t *mark, bool cornerQuotes, bool hollowBrackets)
{
    if (mark == nullptr || mark[0] == L'\0' || mark[1] != L'\0')
        return mark;
    if (cornerQuotes)
    {
        switch (mark[0])
        {
        case L'“':
            return L"『";
        case L'”':
            return L"』";
        case L'‘':
            return L"「";
        case L'’':
            return L"」";
        default:
            break;
        }
    }
    if (hollowBrackets)
    {
        switch (mark[0])
        {
        case L'【':
            return L"〖";
        case L'】':
            return L"〗";
        default:
            break;
        }
    }
    return mark;
}

// 成对模式下每按一次引号键都开一对新的：GetPunctuation 的交替停在后半个时，改回同一组的前半个。不是该键的后半个时原样返回。
inline wchar_t ReopenedPairedQuote(wchar_t key, wchar_t mark)
{
    if (key == L'"' && (mark == L'”' || mark == L'』'))
        return mark == L'”' ? L'“' : L'『';
    if (key == L'\'' && (mark == L'’' || mark == L'」'))
        return mark == L'’' ? L'‘' : L'「';
    return mark;
}

// 候选上屏（空格、数字、回车或点击）时，整条上屏文字恰好是一个左半边才补全右半边，例如从符号候选里选的「或（。与 macOS 一样只看整条文字：以引号或括号结尾的词句原样上屏；`{` 与 `｛` 不在其中，它们只由按键补全。
inline wchar_t PairedPunctuationClosingForCandidate(std::wstring_view text)
{
    if (text.size() != 1 || text[0] == L'{' || text[0] == L'｛')
        return 0;
    return PairedPunctuationClosingFor(text[0]);
}

// 全角模式下按 `{` 键开的一对是全角的 ｛｝，与 macOS 一致；半角时仍是 `{}`。返回这次实际上屏的左半边。
inline wchar_t PairedPunctuationKeyOpening(wchar_t key, wchar_t resolved, bool fullWidth)
{
    return key == L'{' && resolved == L'{' && fullWidth ? L'｛' : resolved;
}

// The closing half the pressed key would step over, or 0 when the key cannot close a tracked pair. Only the closing half of a pair the host auto-completes qualifies (the '{' pair included, whose table entry is ASCII); ASCII output such as direct-mode ',' '.' ':' or the numpad dot and unrelated Chinese marks ('。' '：' '；' ...) must answer 0, because stepping over clears the whole pair stack on a mismatch and would silently drop the pair the user is still inside. Quotes are keyed symmetrically: '"' resolves to either half depending on the legacy left/right toggle, so the resolved character says nothing about intent and the key itself has to answer.
// 全角模式下 `{` 补出的是 ｝，所以那时 `}` 键要跨过的也是 ｝（`fullWidth`）。
inline wchar_t PairedPunctuationStepOverCandidate(wchar_t key, std::wstring_view resolved, bool fullWidth = false)
{
    if (resolved.size() != 1)
        return 0;
    // 引号按键判断，但要看出的是哪一组：直角引号样式下这个键的后半个是』或」。
    if (key == L'"')
        return resolved[0] == L'『' || resolved[0] == L'』' ? L'』' : L'”';
    if (key == L'\'')
        return resolved[0] == L'「' || resolved[0] == L'」' ? L'」' : L'’';
    if (key == L'}' && resolved[0] == L'}' && fullWidth)
        return L'｝';
    switch (resolved[0])
    {
    case L'”':
    case L'’':
    case L'】':
    case L'》':
    case L'〉':
    case L'）':
    case L'}':
    case L'｝':
    case L'」':
    case L'〗':
        return resolved[0];
    default:
        return 0;
    }
}
} // namespace Global
