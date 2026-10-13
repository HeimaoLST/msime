# Agent Note: 词库快照导出绑定目标父目录句柄

Status: implemented

## Problem

离线词库快照导出先在目标父目录创建临时文件，再用路径型 \`persist(destination)\` 发布。目标父目录被替换成符号链接时，导出内容可能写到用户选定目录之外。

## Decision

把校验用临时文件放到系统临时目录，校验完成后复用 \`client-core\` 的 \`replace_private_file\` 发布到目标路径。Unix 发布绑定已打开的父目录句柄并使用 \`renameat\`，不会再次通过可替换路径解析父目录。

## Alternatives considered

- 只检查目标父目录的符号链接：检查和临时文件创建之间仍有竞态窗口。
- 继续在目标目录创建临时文件：路径型发布仍可能被目录替换重定向。
- 复制 \`openat\` 发布逻辑到 Host API：会绕过共享存储层的跨平台实现。

## Consequences

快照格式校验和原子发布语义保持不变；目标目录被替换或是符号链接时导出失败，不会写到外部目录。

## Verification

- \`cargo test -p msime-host-api snapshot_publication_rejects_a_symlinked_parent --locked\`（回归测试在修复前无法通过，修复后通过）
