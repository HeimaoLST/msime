#include "PanelInputChannel.h"

#include <cassert>
#include <csignal>
#include <filesystem>
#include <string>
#include <sys/wait.h>
#include <utility>
#include <vector>

using msime::linux_host::PanelInputBroker;
using msime::linux_host::PanelInputDelivery;
using msime::linux_host::PanelInputFocus;
using msime::linux_host::PanelInputRequest;
using msime::linux_host::parse_panel_input_request;

namespace {

void parses_the_three_requests() {
  const auto generation = parse_panel_input_request(R"({"op":"generation"})");
  assert(generation && generation->kind == PanelInputRequest::Kind::Generation);

  const auto text = parse_panel_input_request(R"({"op":"text","text":"你好😀","after_generation":7})");
  assert(text && text->kind == PanelInputRequest::Kind::Text);
  assert(text->text == "你好😀");
  assert(text->after_generation == 7u);

  const auto key = parse_panel_input_request(
      R"({"op":"key","key":"BackSpace","keycode":14,"shift":true,"control":false,"super":true})");
  assert(key && key->kind == PanelInputRequest::Kind::Key);
  assert(key->key == "BackSpace" && key->keycode == 14);
  assert(key->shift && !key->control && !key->alt && key->super);
  assert(!key->after_generation);
}

void rejects_what_the_ime_route_does_not_carry() {
  // Multi-line text goes through the clipboard so a terminal never sees Enter.
  assert(!parse_panel_input_request(R"({"op":"text","text":"line\nnext"})"));
  assert(!parse_panel_input_request(R"({"op":"text","text":"a\tb"})"));
  assert(!parse_panel_input_request(R"({"op":"text","text":""})"));
  assert(!parse_panel_input_request("{\"op\":\"text\",\"text\":\"" + std::string(4097, 'a') + "\"}"));
  assert(parse_panel_input_request("{\"op\":\"text\",\"text\":\"" + std::string(4096, 'a') + "\"}"));
  assert(!parse_panel_input_request(R"({"op":"key","key":"a b"})"));
  assert(!parse_panel_input_request(R"({"op":"key","key":""})"));
  assert(!parse_panel_input_request(R"({"op":"key","key":"a","keycode":300})"));
  assert(!parse_panel_input_request(R"({"op":"key","key":"a","shift":1})"));
  assert(!parse_panel_input_request(R"({"op":"text","text":"a","after_generation":-1})"));
  assert(!parse_panel_input_request(R"({"op":"paste"})"));
  assert(!parse_panel_input_request(R"(["op","text"])"));
  assert(!parse_panel_input_request("not json"));
}

void rejects_socket_directories_below_a_symlink() {
  const auto root = std::filesystem::temp_directory_path() / "msime-panel-input-path-test";
  const auto outside = root / "outside";
  std::error_code error;
  std::filesystem::remove_all(root, error);
  std::filesystem::create_directories(outside);
  const auto linked = root / "linked";
  std::filesystem::create_directory_symlink(outside, linked);
  // 以 root 身份运行时（Linux 容器里就是这样），root 自己不对外开放的目录里的链接会被当成受信任的系统链接（见 `src/core/SafePath.h`）；把目录改成其他人可写，这条链接就成了任何人都可能放进去的链接。
  std::filesystem::permissions(root, std::filesystem::perms::others_write, std::filesystem::perm_options::add);

  msime::linux_host::PanelInputSocket socket;
  assert(!socket.open((linked / "nested" / "panel-input.sock").string()));
  assert(!std::filesystem::exists(outside / "nested"));
  std::filesystem::remove_all(root, error);
}

struct SocketFixture {
  std::string directory;
  std::string path;
  sockaddr_un address{};

  SocketFixture() {
    char pattern[] = "/tmp/msime-panel-input-XXXXXX";
    const char *created = ::mkdtemp(pattern);
    assert(created);
    directory = created;
    path = directory + "/panel-input.sock";
    address.sun_family = AF_UNIX;
    std::memcpy(address.sun_path, path.c_str(), path.size() + 1);
  }

  ~SocketFixture() { std::filesystem::remove_all(directory); }

  int new_stream_socket() const {
    const int client = ::socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
    assert(client >= 0);
    return client;
  }
};

void leaves_a_busy_listener_untouched_without_blocking() {
  SocketFixture fixture;
  msime::linux_host::PanelInputSocket listener;
  assert(listener.open(fixture.path));
  struct stat original {};
  assert(::lstat(fixture.path.c_str(), &original) == 0);
  std::vector<int> clients;
  bool full = false;
  for (int index = 0; index < 128; ++index) {
    const int client = fixture.new_stream_socket();
    if (::connect(client, reinterpret_cast<const sockaddr *>(&fixture.address), sizeof(fixture.address)) != 0) {
      const int error = errno;
      ::close(client);
      assert(error == EAGAIN);
      full = true;
      break;
    }
    clients.push_back(client);
  }
  assert(full && !clients.empty());

  // 子进程隔离旧实现的无限等待，用管道就绪判断完成，超时后回收再报告失败。
  int completion[2];
  assert(::pipe(completion) == 0);
  const pid_t child = ::fork();
  assert(child >= 0);
  if (child == 0) {
    ::close(completion[0]);
    msime::linux_host::PanelInputSocket contender;
    ::_exit(contender.open(fixture.path) ? 1 : 0);
  }
  ::close(completion[1]);
  pollfd ready{completion[0], POLLIN | POLLHUP, 0};
  int completed;
  do {
    completed = ::poll(&ready, 1, 2000);
  } while (completed < 0 && errno == EINTR);
  if (completed <= 0) ::kill(child, SIGKILL);
  int status = 0;
  assert(::waitpid(child, &status, 0) == child);
  ::close(completion[0]);
  for (const int client : clients) ::close(client);
  assert(completed > 0 && "socket probe blocked on a full listener queue");
  assert(WIFEXITED(status) && WEXITSTATUS(status) == 0);
  struct stat current {};
  assert(::lstat(fixture.path.c_str(), &current) == 0);
  assert(current.st_dev == original.st_dev && current.st_ino == original.st_ino);
}

void keeps_a_live_listener_and_reclaims_a_stale_socket() {
  SocketFixture fixture;
  {
    msime::linux_host::PanelInputSocket listener;
    assert(listener.open(fixture.path));
    msime::linux_host::PanelInputSocket contender;
    assert(!contender.open(fixture.path));
  }
  const int stale = fixture.new_stream_socket();
  assert(::bind(stale, reinterpret_cast<const sockaddr *>(&fixture.address), sizeof(fixture.address)) == 0);
  ::close(stale);
  msime::linux_host::PanelInputSocket replacement;
  assert(replacement.open(fixture.path));
  assert(replacement.listening());
}

void preserves_a_socket_when_the_probe_has_a_protocol_error() {
  SocketFixture fixture;
  const int datagram = ::socket(AF_UNIX, SOCK_DGRAM | SOCK_CLOEXEC, 0);
  assert(datagram >= 0);
  assert(::bind(datagram, reinterpret_cast<const sockaddr *>(&fixture.address), sizeof(fixture.address)) == 0);
  struct stat original {};
  assert(::lstat(fixture.path.c_str(), &original) == 0);
  msime::linux_host::PanelInputSocket contender;
  const bool opened = contender.open(fixture.path);
  ::close(datagram);
  assert(!opened);
  struct stat current {};
  assert(::lstat(fixture.path.c_str(), &current) == 0);
  assert(current.st_dev == original.st_dev && current.st_ino == original.st_ino);
}

struct Harness {
  PanelInputFocus focus;
  std::vector<std::string> delivered;
  std::vector<std::pair<int, std::string>> replies;
  PanelInputDelivery outcome = PanelInputDelivery::Delivered;

  void pump(PanelInputBroker &broker, int64_t now) {
    broker.pump(
        now, [&] { return focus; },
        [&](const PanelInputRequest &request) {
          if (outcome == PanelInputDelivery::Delivered) delivered.push_back(request.text);
          return outcome;
        },
        [&](int fd, std::string reply) { replies.emplace_back(fd, std::move(reply)); });
  }
};

PanelInputRequest text(std::string value, std::optional<uint64_t> after = std::nullopt) {
  PanelInputRequest request;
  request.kind = PanelInputRequest::Kind::Text;
  request.text = std::move(value);
  request.after_generation = after;
  return request;
}

void delivers_at_once_to_a_focused_context() {
  PanelInputBroker broker;
  Harness harness;
  harness.focus = {true, 3};
  broker.submit(-1, text("好"), 0);
  harness.pump(broker, 0);
  assert(harness.delivered == std::vector<std::string>{"好"});
  assert(harness.replies.size() == 1 && harness.replies[0].second == R"({"ok":true})");
  assert(broker.empty());
}

void answers_the_generation_without_needing_focus() {
  PanelInputBroker broker;
  Harness harness;
  harness.focus = {false, 42};
  PanelInputRequest request;
  broker.submit(-1, request, 0);
  harness.pump(broker, 0);
  assert(harness.replies.size() == 1);
  assert(harness.replies[0].second == R"({"generation":42,"ok":true})");
}

void waits_for_a_focus_newer_than_the_panel() {
  // The panel held the focus at generation 5. Its own context must not receive the text; the
  // editor focused after the panel hid itself must.
  PanelInputBroker broker;
  Harness harness;
  harness.focus = {true, 5};
  broker.submit(-1, text("字", 5), 0);
  harness.pump(broker, 0);
  assert(harness.delivered.empty() && harness.replies.empty());
  harness.focus = {true, 6};
  harness.pump(broker, 50000);
  assert(harness.delivered == std::vector<std::string>{"字"});
  assert(broker.empty());
}

void expires_rather_than_typing_late() {
  PanelInputBroker broker;
  Harness harness;
  broker.submit(-1, text("迟"), 0);
  harness.pump(broker, msime::linux_host::kPanelInputWaitUs - 1);
  assert(harness.replies.empty());
  harness.pump(broker, msime::linux_host::kPanelInputWaitUs);
  assert(harness.replies.size() == 1);
  assert(harness.replies[0].second == R"({"error":"no_focus","ok":false})");
  // A focus arriving afterwards finds nothing left to type.
  harness.focus = {true, 1};
  harness.pump(broker, msime::linux_host::kPanelInputWaitUs + 1);
  assert(harness.delivered.empty() && broker.empty());
}

void refuses_a_restricted_context_without_waiting() {
  PanelInputBroker broker;
  Harness harness;
  harness.focus = {true, 1};
  harness.outcome = PanelInputDelivery::Restricted;
  broker.submit(-1, text("密"), 0);
  harness.pump(broker, 0);
  assert(harness.replies.size() == 1);
  assert(harness.replies[0].second == R"({"error":"restricted","ok":false})");
  assert(broker.empty());
}

void keeps_requests_in_order() {
  PanelInputBroker broker;
  Harness harness;
  harness.focus = {true, 2};
  broker.submit(1, text("一", 2), 0);
  broker.submit(2, text("二"), 0);
  harness.pump(broker, 0);
  // The second request is ready on its own, but must not overtake the first.
  assert(harness.delivered.empty());
  harness.focus = {true, 3};
  harness.pump(broker, 10000);
  assert((harness.delivered == std::vector<std::string>{"一", "二"}));
  assert(harness.replies[0].first == 1 && harness.replies[1].first == 2);
}

void rejects_requests_beyond_pending_capacity() {
  PanelInputBroker broker;
  Harness harness;
  for (std::size_t index = 0; index < msime::linux_host::kPanelInputPendingLimit; ++index)
    assert(broker.submit(static_cast<int>(index), text("合成"), 0));
  assert(!broker.submit(999, text("拒绝"), 0));
  harness.pump(broker, msime::linux_host::kPanelInputWaitUs);
  assert(harness.replies.size() == msime::linux_host::kPanelInputPendingLimit);
  assert(broker.empty());
}

std::vector<std::string> stroke(bool press_consumed, bool release_consumed) {
  std::vector<std::string> events;
  msime::linux_host::deliver_panel_key_stroke(
      [&](bool release) {
        events.push_back(release ? "process release" : "process press");
        return release ? release_consumed : press_consumed;
      },
      [&](bool release) { events.push_back(release ? "forward release" : "forward press"); });
  return events;
}

void runs_keys_through_the_input_method_first() {
  // A letter, or a digit or Space with a composition open: the input method keeps the whole stroke, and the editor sees none of it.
  assert((stroke(true, true) == std::vector<std::string>{"process press", "process release"}));
  // The release still reaches the input method after a consumed press, which is what ends a BackSpace hold or a shortcut stroke.
  assert((stroke(true, false) == std::vector<std::string>{"process press", "process release"}));
  // Nothing to compose: the editor gets the key, in the order a physical key would reach it.
  assert((stroke(false, false) == std::vector<std::string>{"process press", "forward press",
                                                           "process release", "forward release"}));
  // Once the press went to the editor its release follows, or the editor would hold the key down.
  assert((stroke(false, true) == std::vector<std::string>{"process press", "forward press",
                                                          "process release", "forward release"}));
}

}  // namespace

int main() {
  parses_the_three_requests();
  rejects_what_the_ime_route_does_not_carry();
  rejects_socket_directories_below_a_symlink();
  leaves_a_busy_listener_untouched_without_blocking();
  keeps_a_live_listener_and_reclaims_a_stale_socket();
  preserves_a_socket_when_the_probe_has_a_protocol_error();
  delivers_at_once_to_a_focused_context();
  answers_the_generation_without_needing_focus();
  waits_for_a_focus_newer_than_the_panel();
  expires_rather_than_typing_late();
  refuses_a_restricted_context_without_waiting();
  keeps_requests_in_order();
  rejects_requests_beyond_pending_capacity();
  runs_keys_through_the_input_method_first();
  return 0;
}
