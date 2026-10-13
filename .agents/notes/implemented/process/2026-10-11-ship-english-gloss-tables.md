# Agent Note: 英文释义三张表随 macOS 与 Windows 发布包下载并打包

Status: implemented

## Problem

`character-glosses/zh-en.db`（Unihan 单字）、`word-glosses/zh-en.db`（CC-CEDICT 词语）和 `pronunciations/en-phonetic.db`（ECDICT 音标）都由仓库里的脚本构建，macOS 的 `stage-resources.sh`、`package-release.sh` 和 Windows 的 `Prepare-PackageFiles.ps1` 只要在 `target/<表名>` 里找到它们就装进 resources 旁边。可是任何发布工作流都没有生成这几个目录，所以每个正式包都缺这三张表：单字和长尾词没有英文释义，英文释义不标音标，整句候选的逐词拆解只剩 `word_breakdown.rs` 里 130 个学习者短语能对上，画出 `别 do not · 问 to ask · 我` 这种半截的行（拆解一侧的修正见 bug-fix 下的 `2026-10-11-gloss-breakdown-needs-tables.md`）。

在 CI 里照锁重建也行不通：MDBG 每天用新导出覆盖 CC-CEDICT 的下载地址，`word-glosses.lock.json` 钉的 2026-09-23 摘要第二天起就下载不到了。

## Decision

三张表按 `offline-glosses` 的做法分发：构建好的数据库和 NOTICE 发布在 `metasequoiaime/chinese-ime-lm`，各占一个 release（两张表都叫 `zh-en.db`，放一起会重名）：

- `character-glosses-unihan-17.0.0`：`zh-en.db`、`character-glosses-NOTICE.txt`
- `word-glosses-2026.10.11`：`zh-en.db`、`word-glosses-NOTICE.txt`，以及构建所用的 CC-CEDICT 导出 `cedict_1_0_ts_utf-8_mdbg-2026.10.11.zip`
- `pronunciations-ecdict-82c9872`：`en-phonetic.db`、`pronunciations-NOTICE.txt`

每张表的锁在原有的 `artifact`（上游输入）之外新增 `built`，列出这些发布文件的 URL、SHA-256 和长度。`word-glosses.lock.json` 的 `artifact.url` 指向镜像的那份导出，从锁重建得到与发布物逐字节相同的 `zh-en.db` 和 NOTICE。

`scripts/fetch_gloss_tables.py` 按三张锁的 `built` 下载到 `target/<表名>`，下载与校验复用 `fetch_offline_glosses.fetch`（流式限长、暂存旁路、摘要不符即丢弃），已在锁定摘要的文件跳过。`release-macos.yml`、`ci-macos-package.yml` 和 `release-windows.yml` 在打包前调用它；打包脚本不变。Linux、Android、iOS、HarmonyOS 的打包不读这几个目录，不在本次范围。

## Alternatives considered

- **CI 里每次从上游源头构建** — 不依赖额外的托管位置，锁里只记上游输入。Unihan 和 ECDICT 的地址是带版本或提交号的，可以这么做；CC-CEDICT 的地址每天被覆盖，锁住的摘要隔天就失效，发版会在下载那一步失败。三张表用两种取法只会让流程更难懂，所以统一下载构建好的文件，CC-CEDICT 的原始导出另外镜像，保留可复现性。
- **把三张表提交进仓库** — 最简单，不用托管。但三张表约 12 MB 的二进制，每换一次数据源就在历史里永久多一份；仓库里的其他词库也都走锁文件加发布资产，没有先例。
- **放进 `metasequoiaime/msime` 自己的 release** — 不用跨仓库。但应用内的更新检查读的就是这个仓库的 releases，和 `offline-glosses` 放到 `chinese-ime-lm` 的理由相同。

## Consequences

- **收益**：macOS 和 Windows 的发布包带上三张表：单字和长尾词有英文释义，英文释义有音标，整句候选的逐词拆解能对上每个词。`word-glosses` 从此可以照锁复现，不再受 MDBG 覆盖地址的影响。
- **代价与已知上限**：多了 6 个发布文件和一个镜像要维护。换数据源（新的 CC-CEDICT 导出、新的 Unihan 版本）要先构建、发布到新 release，再同时更新锁的 `artifact` 和 `built`；只改 `artifact` 不改 `built`，打进包的还是旧表。其他平台若要接入这几张表，在各自的发布工作流里调用同一个脚本即可。

## Verification

- 从镜像的 CC-CEDICT 导出运行 `scripts/build_word_glosses.py`，得到的 `zh-en.db`（`9214834…cd926`）和 NOTICE 与发布文件的 SHA-256 相同。
- `scripts/fetch_gloss_tables.py --out <空目录>` 下载全部 6 个文件；对同一目录再跑一次，每个文件都报 already at the locked digest。
- `scripts/test-word-glosses.py`、`test-character-glosses.py`、`test-pronunciations.py`、`test-fetch-offline-gloss-bounds.py`、`test-fetch-staged-file-cleanup.py` 通过，三个改过的工作流过 actionlint。
- 真实表里 `我` 是 `I, me; we, us`、`握` 是 `grasp, hold fast, take by hand`，所以 `别问我` 的拆解是 `别 do not · 问 to ask · 我 I`。
