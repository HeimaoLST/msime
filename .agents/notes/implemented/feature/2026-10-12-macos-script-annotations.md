# Agent Note: macOS 候选窗把脚本插件的注释画在释义行的最后一行

Status: implemented

## Problem

[脚本插件改写上屏与重排、注释、过滤候选](../architecture/2026-10-12-script-plugins-modify-commit-and-candidates.md) 把插件的候选注释放进候选的 `script_annotation` 键，不并进引擎的 `annotation`，由宿主另行绘制。在宿主接上之前，声明了 `annotate_candidates` 的插件写的注释用户看不见。

macOS 候选窗每一行已经有三段：候选文字、紧跟其后的辅助码或引擎注释（候选字号、正文色），以及 12 点的释义行（读音、译文、逐词英文，释义色）。插件注释要能和这三段区分开：它是第三方插件写的文字，不能让人当成输入法自己的辅助码或释义；它不能替换引擎的注释；它的长度和字符由 runtime 限制（≤ 32 个 UTF-16 码元，不含 Cc、Cf、U+2028、U+2029），但宿主的排版不该靠另一层的保证才安全；还要跟着皮肤和明暗走，读屏能读到。

## Decision

**插件注释是释义行的最后一行。** `InputController.mm` 的 `candidatePageGeometry:` 读候选的 `script_annotation`，经 `MSIMECandidateScriptAnnotationRun` 收拾后存进 `MSIMECandidatePageGeometry::scriptAnnotations`，再用 `MSIMECandidateGlossWithScriptAnnotation` 接在这一行的释义（韩文汉字的训音、译文、读音、逐词英文）后面另起一行，量宽高和画用的是同一个字符串。所以它沿用释义行现成的排版规则（`CandidateItemLayout.h` 不改）：横排时释义行总在候选下面，竖排时放得下就留在候选那一行，放不下就在列内折行，卡片宽度仍以半屏封顶。插件注释排在最后，训音、译文行的起点和按列上屏的下划线位置都不受影响。引擎的 `annotation` 照旧画在候选文字后面，两者同时出现。

**画成斜体、释义色。** `MSIMECandidateButton` 新增 `scriptAnnotation`，`drawRect:` 给释义行末尾这一段加 `NSObliquenessAttributeName`（`MSIMECandidateScriptAnnotationObliqueness` = 0.2），颜色和这一行的译文相同（皮肤的 `translation` 色，没有时按高亮与否取序号色）。斜体是对任何字体都有效的合成倾斜，中文也能看出来，插件改不了样式，所以写成像译文的文字也冒充不了译文。

**宿主自己收拾文本。** `MSIMECandidateScriptAnnotationRun`（`CandidateChrome.h`）：不是字符串时为空；`controlCharacterSet`（Cc、Cf，含双向控制符和零宽字符）和 `newlineCharacterSet`（含 U+2028、U+2029）连成的一段换成一个空格，再去掉首尾空白；超过 `MSIMECandidateScriptAnnotationLimit`（32 个 UTF-16 码元）时按完整字符截到 31 个码元以内再补「…」，不拆开代理对和组合字符。释义行按 `"\n"` 分行，macOS 又拿 U+2028 当会话里的释义分行（见 [多语言释义用 U+2028 分行](../bug-fix/2026-10-08-macos-gloss-line-separator.md)），漏进一个换行就会多出一行。

**不做繁简转换。** 插件注释是插件写的说明，不是候选，也不上屏，原样显示。

**悬停提示和读屏。** 悬停提示把它和释义一起列在候选下面。读屏标签在原来的「序号 候选（辅助码）」之后加「，插件注释：……」，说明这段是插件写的。

**只重画译文的捷径不覆盖注释变化。** `MSIMEOnlyCandidateTranslationsChanged` 比较除 `translation` 外的全部字段，注释变了就走完整重建；捷径里再比对一次按钮的 `scriptAnnotation`，`translationBelow` 的判断也把它算进去。

## Testing

- `platforms/macos/tests/candidate/CandidateRowLayoutTest.mm`（ctest `candidate-row-layout`）经控制器渲染真实页面：收拾规则（换行、U+2028、U+2029、U+202E、U+200B 换成空格，首尾空白，非字符串，恰好 32 个码元不截，34 个码元截成 31 个码元再加「…」，40 个码元的 emoji 截在代理对边界）；横排时有注释的行引擎注释、译文都在，释义行比没有注释的邻行高一行，插件注释不进标题和 `translation`，悬停提示和读屏标签如上；没有译文时注释自己占一行，插件写的换行画不出第二行；只换注释的视图换掉按钮上的注释；竖排时注释留在候选那一行，32 个 U+FDFD 这样极宽的字符在列内折行、卡片不超过半屏、行高容得下。把控制器里给按钮赋值的那一行改成空串，这个测试在检查按钮注释的那条断言上失败。
- 本机 `ctest --test-dir target/macos-isolated` 149 项全部通过。用同一个测试把面板离屏画成 PNG 看过：横排时「常用词」斜体排在「Chinese」下面，竖排时超长注释在高亮行内折行。

## Alternatives considered

- **在 `CandidateItemLayout` 里加第四段，紧跟辅助码画在候选那一行。** 最强的理由是语义最清楚，插件注释有自己的位置和规则，不和释义共用一行。不用：候选字号的插件注释会让每一行宽出好几倍，韩文汉字的训音就是因此挪到释义行的；而且这套排版是 Windows `candidate_item_layout` 的移植，加一段要改单行列宽、换行和整页布局几处的算法和它们的测试。释义行已经处理好了折行、预留高度和卡片封顶。
- **接在引擎注释后面，同一段画出来。** 最强的理由是一行代码都不用加进排版。不用：用户分不出哪段是输入法的辅助码、哪段是插件写的，核心那边不把它并进 `annotation` 也正是为此。
- **用皮肤的强调色或加「插件：」前缀区分。** 最强的理由是来源一眼就能看出来。不用：强调色没有保证在高亮行的底色上看得清（高亮行的文字用的是皮肤的另一组颜色），释义色已经按皮肤和明暗、高亮与否分别配好；前缀占掉 32 个码元的一部分，还让每一行变宽。来源在读屏标签里明说。
- **相信 runtime 已经收拾过，宿主直接画。** 最强的理由是不重复 runtime 的校验。不用：释义行按换行分行，宿主排版安全不该取决于另一层的约定；收拾一次只是几十个码元的扫描。
- **繁体输出时一并转换。** 最强的理由是整个候选窗的字形一致。不用：它不是候选，不上屏；转换可能改掉插件特意写的字（人名、专名）。

## Consequences

- 收益：插件注释在 macOS 上看得见，和辅助码、译文分得开，引擎注释原样保留；排版沿用释义行，不改 Windows 移植过来的布局算法；不依赖 runtime 的长度和字符限制也画不出多余的行，也撑不破卡片。
- 代价：横排时有插件注释的页面高一个释义行。宿主事先不知道哪一页会有注释，没有为它预留高度，所以同一次组字里注释时有时无，卡片高度会跟着变。
- 斜体是合成的倾斜，个别字体看起来可能只是略斜；读屏用户靠标签里的「插件注释」区分。
- 没有在装好的输入法里配真实的脚本插件看过（不在日常使用的机器上安装输入法），验证停在控制器渲染和离屏截图这一层。
- Windows 和 Linux 宿主怎么画是它们各自的改动。
