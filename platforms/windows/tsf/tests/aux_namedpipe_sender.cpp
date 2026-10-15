#include "AuxNamedpipeSender.h"

#include <cstdio>
#include <cstring>
#include <thread>
#include <vector>

namespace
{
int failures = 0;

void Require(bool value, const char *what)
{
    if (!value)
    {
        std::fprintf(stderr, "Aux sender: %s\n", what);
        ++failures;
    }
}

class Handle
{
public:
    explicit Handle(HANDLE value) : value_(value) {}
    ~Handle()
    {
        if (value_ && value_ != INVALID_HANDLE_VALUE)
        {
            CloseHandle(value_);
        }
    }
    Handle(const Handle &) = delete;
    Handle &operator=(const Handle &) = delete;
    HANDLE get() const { return value_; }

private:
    HANDLE value_;
};

// 测试服务端使用真正的重叠管道；超时后先取消并收回 I/O，再释放栈上的 OVERLAPPED。
bool FinishIo(HANDLE pipe, OVERLAPPED &operation, BOOL started, DWORD &bytes)
{
    if (!started && GetLastError() != ERROR_IO_PENDING)
    {
        return false;
    }
    if (WaitForSingleObject(operation.hEvent, 2000) != WAIT_OBJECT_0)
    {
        CancelIoEx(pipe, &operation);
        GetOverlappedResult(pipe, &operation, &bytes, TRUE);
        return false;
    }
    return GetOverlappedResult(pipe, &operation, &bytes, FALSE) != FALSE;
}

std::vector<unsigned char> Reply(const std::wstring &text)
{
    const auto *first = reinterpret_cast<const unsigned char *>(text.data());
    return {first, first + text.size() * sizeof(wchar_t)};
}

struct Outcome
{
    bool accepted = false;
    bool requestReceived = false;
    bool serverRemainedBlocking = false;
    ULONGLONG elapsedMs = 0;
};

Outcome Exchange(const std::vector<unsigned char> &reply, DWORD delayMs = 0,
                 bool waitForAcknowledgement = true, bool disconnect = false)
{
    static unsigned serial = 0;
    const std::wstring name = L"\\\\.\\pipe\\MSIMEAuxSenderTest-" + std::to_wstring(GetCurrentProcessId()) + L"-" +
                              std::to_wstring(++serial);
    Handle pipe(CreateNamedPipeW(name.c_str(), PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED,
                                 PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT, 1, 512, 512, 0, nullptr));
    Outcome outcome;
    if (pipe.get() == INVALID_HANDLE_VALUE)
    {
        Require(false, "create isolated message pipe");
        return outcome;
    }
    Handle connected(CreateEventW(nullptr, TRUE, FALSE, nullptr));
    Handle finished(CreateEventW(nullptr, TRUE, FALSE, nullptr));
    OVERLAPPED connection{};
    connection.hEvent = connected.get();
    const BOOL connecting = ConnectNamedPipe(pipe.get(), &connection);
    const DWORD connectError = connecting ? ERROR_SUCCESS : GetLastError();
    if (!connecting && connectError != ERROR_IO_PENDING && connectError != ERROR_PIPE_CONNECTED)
    {
        Require(false, "start isolated pipe connection");
        return outcome;
    }

    const std::wstring request = L"TypingKeys|2000-01-01|";
    std::thread server([&] {
        DWORD bytes = 0;
        if (connectError != ERROR_PIPE_CONNECTED)
        {
            // FinishIo 读取的是调用线程的最后错误，显式恢复异步连接的结果。
            SetLastError(connectError);
            if (!FinishIo(pipe.get(), connection, connecting, bytes))
            {
                return;
            }
        }
        Handle ready(CreateEventW(nullptr, TRUE, FALSE, nullptr));
        OVERLAPPED read{};
        read.hEvent = ready.get();
        wchar_t received[128]{};
        const BOOL reading = ReadFile(pipe.get(), received, sizeof(received), nullptr, &read);
        if (!FinishIo(pipe.get(), read, reading, bytes))
        {
            return;
        }
        outcome.requestReceived = bytes == request.size() * sizeof(wchar_t) &&
                                  std::memcmp(received, request.data(), bytes) == 0;
        DWORD serverMode = 0;
        outcome.serverRemainedBlocking = GetNamedPipeHandleStateW(pipe.get(), &serverMode, nullptr, nullptr, nullptr,
                                                                 nullptr, 0) &&
                                        (serverMode & PIPE_NOWAIT) == 0;
        if (disconnect)
        {
            DisconnectNamedPipe(pipe.get());
            return;
        }
        if (delayMs > 0)
        {
            Sleep(delayMs);
        }
        if (!reply.empty())
        {
            ResetEvent(ready.get());
            OVERLAPPED write{};
            write.hEvent = ready.get();
            const BOOL writing = WriteFile(pipe.get(), reply.data(), static_cast<DWORD>(reply.size()), nullptr, &write);
            FinishIo(pipe.get(), write, writing, bytes);
        }
        // 保持连接到客户端返回，避免 ACK 尚未读取时就被服务端断开丢弃。
        WaitForSingleObject(finished.get(), 2000);
        DisconnectNamedPipe(pipe.get());
    });

    const ULONGLONG started = GetTickCount64();
    outcome.accepted = msime::windows::detail::SendToAuxNamedpipe(name.c_str(), request, waitForAcknowledgement);
    outcome.elapsedMs = GetTickCount64() - started;
    SetEvent(finished.get());
    server.join();
    Require(outcome.requestReceived, "production sender delivers the synthetic empty probe");
    Require(outcome.serverRemainedBlocking, "client mode leaves the Server in PIPE_WAIT");
    return outcome;
}
}

int main()
{
    Require(Exchange(Reply(L"OK")).accepted, "accept exact immediate UTF-16 OK");

    const auto delayed = Exchange(Reply(L"OK"), 40);
    Require(delayed.accepted, "poll until delayed OK arrives");
    Require(delayed.elapsedMs >= 25 && delayed.elapsedMs < 500, "delayed acknowledgement remains bounded");

    Require(!Exchange(Reply(L"NO")).accepted, "reject a negative acknowledgement");
    Require(!Exchange(Reply(L"O")).accepted, "reject a short UTF-16 acknowledgement");
    Require(!Exchange({static_cast<unsigned char>('O')}).accepted, "reject an incomplete UTF-16 code unit");
    Require(!Exchange(Reply(std::wstring(L"OK\0", 3))).accepted, "reject an OK prefix followed by extra bytes");
    Require(!Exchange({}, 0, true, true).accepted, "reject a Server disconnect before acknowledgement");

    const auto timeout = Exchange({});
    Require(!timeout.accepted, "reject a Server that never acknowledges");
    Require(timeout.elapsedMs >= 100 && timeout.elapsedMs < 500, "no reply returns after the 150ms deadline");

    const auto tooLate = Exchange(Reply(L"OK"), 220);
    Require(!tooLate.accepted, "reject an acknowledgement after the deadline");
    Require(tooLate.elapsedMs >= 100 && tooLate.elapsedMs < 500, "late acknowledgement cannot extend the deadline");

    const auto noAcknowledgement = Exchange({}, 0, false);
    Require(noAcknowledgement.accepted, "send without an acknowledgement when none was requested");

    if (failures == 0)
    {
        std::puts("Aux sender: isolated named-pipe acknowledgement tests passed");
    }
    return failures == 0 ? 0 : 1;
}
