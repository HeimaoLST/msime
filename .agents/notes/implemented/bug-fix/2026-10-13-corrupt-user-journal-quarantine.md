# Agent Note: 用户词库日志损坏时挪开，不再让宿主起不来

Status: implemented

## Problem

一台 Windows 机器上的输入法完全打不了字：看门狗在跑，Server 起来后立刻以退出码 1 退出，`server.log` 一行都没有。直接调用 `msime_client_prepare_host` 得到 `Runtime dictionary replay failed: invalid user dictionary database`。原因是 `%LOCALAPPDATA%\metasequoiaime-full\user\msime_user.db` 只剩最后两页（一个索引叶子页）还有内容，其余 21 页全是零，SQLite 不认它是数据库。

每个宿主在第一个会话之前都要准备词库代次，准备时回放日志（`generation.rs` 的 `replay_into`）。日志读不出来，回放失败，准备失败，Windows Server 在打开诊断日志之前就退出了；看门狗不停重启它，每次都一样。用户能做的只有手动把文件挪开，而且从界面和日志里都看不出要这样做。

文件是怎么变成全零的没有查清：那段时间系统没有异常关机记录（事件 41、6008 都没有），也找不到写它的程序。这条笔记只处理"坏了之后怎么办"。

## Decision

`msime_engine::quarantine_corrupt_journal`（`user_dictionary/journal.rs`）在日志读不出是数据库时把它改名挪开：

- 只认 SQLite 自己的判断：读 `sqlite_master` 失败且错误码是 `SQLITE_NOTADB` 或 `SQLITE_CORRUPT` 才挪。忙、加锁、没权限、文件不在、零字节的空库都不动。
- 改名成 `msime_user.db.corrupt-<unix 秒>`，同名的 `-wal`、`-shm`、`-journal` 一起改成同样的名字，免得旧的 WAL 被套到新日志上。先挪旁路文件，再挪主文件，进程中途退出时原路径不会留下会被新日志套用的旁路文件；目标名会同时避开主文件和旁路文件。同一秒再坏一次时加 `-1`、`-2`，不覆盖前一份。什么都不删。
- 挪之前关掉本线程缓存的日志连接，Windows 不能改名打开着的文件。

`prepare_runtime_paths_for` 在回放之前调用它，所以每条准备代次的路径（宿主准备、个人词库后端、学习）都受保护，挪了就往 stderr 写一行。宿主库的 `prepare_shipped_host_configuration` 在准备代次之前先调一次，挪了就经 `diagnostics::report` 报 `user dictionary journal moved aside`，到了引擎里再查一遍只是空操作。

## Alternatives considered

- **只在 Windows Server 里处理**：Server 拿到这个错误后自己挪文件再重试。macOS、Linux、移动端的宿主走的是同一条准备路径，同样会被一个坏日志卡死，只修一个宿主等于把同样的坑留给其他平台。
- **回放失败时跳过日志、照常启动但不挪文件**：宿主能起来，但之后每个会话打开日志都会失败（`open_journal` 建表时同样读不出），学习写不进去，而且每次启动都重复失败。
- **直接删掉坏文件**：省一个文件，但证据也没了，用户和维护者都无从查起，而且一旦判断错了就是删掉一份好日志。
- **出现任何打开错误都挪**：会把只是一时被占用或没权限的好日志挪走，代价是用户的学习数据，比起不来更糟。

## Consequences

- **收益**：一个坏日志的代价从"输入法起不来"降到"学习数据从头开始"；坏文件原样留在旁边，可以拿来分析。
- **代价与已知上限**：Windows Server 的诊断日志要等开关打开之后才写，而开关是在 `prepare_host` 之后才应用的，所以这一行在 Windows 上落不进 `server.log`，也没有给用户的提示框。用户能看到的痕迹只有 `user` 目录里的 `.corrupt-` 文件。做提示需要宿主有启动阶段的通知通道，这次没有做。日志被写坏的根因也没有找到。

## Verification

- `cargo test -p msime-engine --lib` 新增三个测试：全零（末尾留一个索引页，和现场那份同形）的日志连同 `-wal` 被挪开、同一秒再坏一次不覆盖；能读的、零字节的、不存在的日志不动；带坏日志准备代次仍然成功，之后写进的日志照常回放。
- `cargo test -p msime-host-api --lib` 新增端到端测试：准备一次后把日志写成全零，再准备仍然成功、日志被挪开。把两处调用去掉后，这个测试以现场同样的 `Runtime dictionary replay failed: invalid user dictionary database` 失败。
- 两个 crate 全部 lib 测试的失败（engine 的 `positions::...ordinary_rows_skip_dynamic_partition...`、日文解码器的一项，host-api 的 11 项）在没改动的 develop 上同样失败，与本改动无关。`cargo clippy -p msime-engine -p msime-host-api --lib --tests` 无告警。
