"""独立 D-Bus 的真实 Fcitx5 前端验收；请求与候选全部为合成数据。"""
import ctypes
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time

import dbus
import dbus.mainloop.glib

from daemon import ResponseDecoder, daemon_environment, wait


def main():
    resources, library, addon = map(Path, sys.argv[1:4])
    case = sys.argv[4]
    ai = case.startswith("ai-")
    failure = case.endswith("failure")
    cache_hit = case == "ai-cache-hit"
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SessionBus()
    assert not bus.name_has_owner("org.fcitx.Fcitx5")
    bus.request_name("org.freedesktop.portal.Desktop")
    requests, rows, errors = [], [], []
    stop = threading.Event()
    with tempfile.TemporaryDirectory(prefix="msime-online-requests-") as directory:
        root = Path(directory)
        env = daemon_environment(root, addon)
        assert env.get("XDG_STATE_HOME") == str(root / "xdg-state"), "Fcitx5 统计状态必须隔离"
        host = ctypes.CDLL(str(library))
        decoder = ResponseDecoder(host)
        host.msime_client_prepare_host.argtypes = [ctypes.c_char_p, ctypes.c_size_t]
        host.msime_client_prepare_host.restype = ctypes.c_void_p
        for name in ("load_preferences", "save_preferences"):
            getattr(host, "msime_client_" + name).restype = ctypes.c_void_p
        host.msime_client_load_preferences.argtypes = [ctypes.c_char_p, ctypes.c_size_t]
        host.msime_client_save_preferences.argtypes = [ctypes.c_char_p, ctypes.c_size_t,
                                                       ctypes.c_uint64, ctypes.c_char_p, ctypes.c_size_t]

        def call(raw):
            result = decoder.decode(raw)
            assert result["ok"], result
            return result["value"]

        bootstrap = json.dumps({"resources": str(resources), "state_root": str(root / "state")}).encode()
        options = call(host.msime_client_prepare_host(bootstrap, len(bootstrap)))
        preferences = options["preferences"]
        preferences.update(learning=False, usage_reporting=False, default_ime_mode="chinese",
                           cloud_candidates=not ai, candidate_translations=False,
                           candidate_english_gloss=False, candidate_page_size=9)
        preferences["ai_assistant"].update(enabled=ai, token="synthetic-token", model="synthetic",
                                          endpoint="https://synthetic.invalid/v1/chat/completions",
                                          candidate_limit=2)
        path = str(root / "online.sock")
        options["online_provider_socket"] = path
        store = options["preferences_directory"].encode()
        snapshot = call(host.msime_client_load_preferences(store, len(store)))
        snapshot["preferences"] = preferences
        document = json.dumps(snapshot).encode()
        call(host.msime_client_save_preferences(store, len(store), snapshot["revision"],
                                               document, len(document)))
        (root / "options.json").write_text(json.dumps(options))
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        server.bind(path)
        server.listen(8)
        server.settimeout(0.1)

        def serve():
            while not stop.is_set():
                try:
                    client, _ = server.accept()
                except socket.timeout:
                    continue
                with client:
                    try:
                        client.settimeout(3)
                        request = json.loads(client.makefile().readline(16385))
                        assert request["kind"] == "online"
                        cache = request["query"].get("ai_cache_only", False)
                        requests.append(cache)
                        if failure:
                            continue
                        candidates = []
                        if cache_hit:
                            candidates = [{"text": "合成缓存" if cache else "合成新答案", "source": 1}]
                        client.sendall((json.dumps({"candidates": candidates}) + "\n").encode())
                    except Exception as error:
                        errors.append(str(error))

        worker = threading.Thread(target=serve)
        worker.start()
        env["FCITX_X11_USE_CLIENT_SIDE_UI"] = "1"
        with (root / "daemon.log").open("w") as log:
            daemon = subprocess.Popen(["fcitx5", "-D", "--keep"], env=env, stdout=log, stderr=log)
            try:
                wait(lambda: bus.name_has_owner("org.fcitx.Fcitx5"))
                control = dbus.Interface(bus.get_object("org.fcitx.Fcitx5", "/controller"),
                                         "org.fcitx.Fcitx.Controller1")
                frontend = dbus.Interface(bus.get_object("org.fcitx.Fcitx5", "/org/freedesktop/portal/inputmethod"),
                                          "org.fcitx.Fcitx.InputMethod1")
                context_path, _ = frontend.CreateInputContext([("program", "synthetic-online-editor")])
                context = dbus.Interface(bus.get_object("org.fcitx.Fcitx5", context_path),
                                         "org.fcitx.Fcitx.InputContext1")
                context.connect_to_signal("UpdateClientSideUI",
                                          lambda *args: rows.append([str(row[1]) for row in args[4]]))
                context.SetCapability(dbus.UInt64(2 | 16 | 64 | (1 << 39)))
                context.FocusIn()
                control.SetCurrentIM("msime")
                control.Activate()

                def key(symbol):
                    assert context.ProcessKeyEvent(symbol, 0, 0, False, 0)
                    context.ProcessKeyEvent(symbol, 0, 0, True, 0)

                for composition in range(2):
                    start = len(requests)
                    key(ord("n"))
                    key(ord("i"))
                    if cache_hit:
                        wait(lambda: any("合成缓存" in row for page in rows for row in page))
                    wait(lambda: requests[start:].count(False) >= 1)
                    if cache_hit:
                        wait(lambda: any("合成新答案" in row for page in rows for row in page))
                    deadline = time.monotonic() + 1.5
                    wait(lambda: time.monotonic() >= deadline)
                    assert requests[start:].count(False) == 1, "相同查询空回包或失败后重复请求网络"
                    assert requests[start:].count(True) == int(ai), "每个已观察组合只探测一次 AI 缓存"
                    assert not errors, errors
                    key(0xFF1B)
                    rows.clear()
                context.FocusOut()
                context.DestroyIC()
                control.Exit()
                assert daemon.wait(timeout=10) == 0
                print(json.dumps({"case": case, "network_requests": requests.count(False),
                                  "cache_probes": requests.count(True), "result": "passed"}))
            finally:
                if daemon.poll() is None:
                    daemon.terminate()
                    daemon.wait(timeout=10)
                stop.set()
                worker.join(timeout=5)
                assert not worker.is_alive(), "合成服务线程未退出"
                server.close()


if __name__ == "__main__":
    main()
