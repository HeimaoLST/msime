#pragma once

#include <windows.h>
#include <string>

namespace msime::windows::detail
{
inline bool SendToAuxNamedpipe(const wchar_t *pipeName, const std::wstring &pipeData, bool waitForAcknowledgement)
{
    if (pipeData.length() > MAXDWORD / sizeof(wchar_t))
    {
        return false;
    }
    const DWORD messageBytes = static_cast<DWORD>(pipeData.length() * sizeof(wchar_t));
    HANDLE pipe = INVALID_HANDLE_VALUE;

    // 保留短暂重试，让刚启动的 Server 有时间创建 Aux 管道。
    for (int retry = 0; retry < 5; ++retry)
    {
        pipe = CreateFileW(pipeName, GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
                           SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION, nullptr);
        if (pipe && pipe != INVALID_HANDLE_VALUE)
        {
            break;
        }
        Sleep(20);
    }
    if (!pipe || pipe == INVALID_HANDLE_VALUE)
    {
        return false;
    }

    // 管道名跨登录会话可见，只接受当前会话的 Server。
    ULONG serverSession = 0;
    DWORD ownSession = 0;
    if (!GetNamedPipeServerSessionId(pipe, &serverSession) ||
        !ProcessIdToSessionId(GetCurrentProcessId(), &ownSession) || serverSession != ownSession)
    {
        CloseHandle(pipe);
        return false;
    }

    // 请求发出后 Server 可能已开始回写，必须先设置确认读取模式，避免此时切换模式失败。
    if (waitForAcknowledgement)
    {
        DWORD pipeMode = PIPE_READMODE_MESSAGE | PIPE_NOWAIT;
        if (!SetNamedPipeHandleState(pipe, &pipeMode, nullptr, nullptr))
        {
            CloseHandle(pipe);
            return false;
        }
    }

    DWORD bytesWritten = 0;
    const BOOL ret = WriteFile(pipe, pipeData.c_str(), messageBytes, &bytesWritten, nullptr);
    const bool sent = ret && bytesWritten == messageBytes;
    if (!sent || !waitForAcknowledgement)
    {
        CloseHandle(pipe);
        return sent;
    }

    bool acknowledged = false;
    const ULONGLONG deadline = GetTickCount64() + 150;
    while (GetTickCount64() < deadline)
    {
        wchar_t acknowledgement[2] = {};
        DWORD bytesRead = 0;
        if (ReadFile(pipe, acknowledgement, sizeof(acknowledgement), &bytesRead, nullptr))
        {
            acknowledged =
                bytesRead == sizeof(acknowledgement) && acknowledgement[0] == L'O' && acknowledgement[1] == L'K';
            break;
        }
        if (GetLastError() != ERROR_NO_DATA)
        {
            break;
        }
        Sleep(1);
    }
    CloseHandle(pipe);
    return acknowledged;
}
}
