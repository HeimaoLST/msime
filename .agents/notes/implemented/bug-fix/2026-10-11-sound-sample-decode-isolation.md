# Agent Note: 音效样本解码失败只静音它自己的位置

Status: implemented

## Problem

`crates/host-api/src/key_sound/player.rs` 的 `load` 对每个样本写的是 `sample(...)?`，任何一个样本解码失败（最常见的是超过 1.5 秒、或采样率低于 8 kHz，这两项导入时不检查）都让整次载入返回 `Err`。一次载入同时装按键包和另选的旋律包，于是一个坏掉的成就音会让按键包的其余键、上屏音以及完全无关的旋律包一起静音。`docs/plugins.md` 写的是「超出的样本会被跳过，那个键不出声」，代码与文档不符。

## Decision

样本解码失败只空出用到它的位置：按键包的某类键、上屏音、成就音，或旋律包的旋律。`Samples::skipped` 记下每个失败文件一条「包: 文件: 原因」，`Worker::loaded` 把它们合成一行，以 `sound sample skipped` 类别经 `diagnostics::report` 报告一次。失败的文件也记进解码缓存，被几类键共用的 `default` 坏了只解码一次、只记一条。

包这一级整包失败：包解析不了（未安装、清单无效）、或选作旋律的包不是 `sequence` 模式时，整次载入失败，报告 `sound pack not loaded`，全部静音。

## Alternatives considered

- **按包隔离，而不是按样本**：把按键包和旋律包分成两次载入，各自失败互不影响。它能修好「旋律包被连累」，但按键包里一个坏的成就音仍然会让所有键静音，与文档「那个键不出声」仍不符；而且要把一个 `Selection` 拆成两条载入代次，改动面比按样本跳过大得多。
- **在导入时就拒绝超长样本**：从源头堵住。但时长和采样率要读 WAV 头，`docs/plugins.md` 明确把这项检查放在宿主解码前；已经装好的包也不会被重新导入，宿主侧仍然要处理坏样本。
- **每个坏样本各报一行**：信息更细，但一个包几个坏样本就刷几行诊断日志，macOS 只记类别时这几行完全相同。合成一行与整包失败「一次载入报一次」的节奏一致。

## Consequences

一个包里个别样本坏掉时，其余声音照常播放，用户能听出是哪个键不响，而不是整个插件看起来不起作用。代价是诊断类别多了一个 `sound sample skipped`，宿主若按类别过滤需要认识它（macOS 与 Windows 只原样记类别，不需要改）。整包失败仍是一次载入报一行 `sound pack not loaded`。

## Verification

`crates/host-api/src/key_sound/tests.rs` 的 `a_sample_that_does_not_decode_silences_only_its_own_sound` 覆盖：按键包 `default` 坏而 `space`、`commit` 好时只有回退到 `default` 的键和成就音静音；同一按键包配内置旋律包时旋律照常；旋律包样本坏时只有旋律静音、上屏音照常；包解析不了时整包静音；坏样本被四处引用（三类键和成就音）只记一条。若任一样本解码失败仍让整次载入失败，该测试在空格键断言处失败。
