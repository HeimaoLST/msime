# Agent Note: Android 分页网格接手手势时保留首段位移

Status: implemented

## Problem

完整资源评测的API 28装包验收中，复制设备信息两次停在剪贴板等待，截图显示菜单仍在第一页并误触单手模式。同一二进制在编译任务结束后通过，不能先断言全部由产品手势处理造成。静态追踪另发现`PagedTileGrid.onInterceptTouchEvent`在首次确认横拖时重置`lastX`，却没有消费此前位移；Android将该事件转换为子控件的取消，后续事件才交给网格，低密度MOVE序列可能丢失大段拖动。先用安装产品的真实View及真实分发建立确定性失败，不能靠延长复制超时掩盖。

## Decision

在分页网格接手横向手势的当次事件消费从前一触点到当前触点的位移，后续事件沿用同一增量与边界钳制。不改变翻页速度阈值、整页吸附、子按钮点击或垂直手势归属。回归直接加载已安装APK的生产View，通过`dispatchTouchEvent`发送从可点击磁贴开始的稀疏横拖，检查即时滚动、慢速松手、前后翻页和不误点。

## Historical audit

检索`PagedTileGrid`、菜单动画、复制设备信息及手势。[设备门禁笔记](../testing/2026-10-08-android-device-gates.md)部分重叠，记录翻页动画中移出窗口与旧系统无障碍缺口，没有接手时的位移契约；[菜单顺序笔记](2026-10-13-android-function-menu-order.md)持有排列与去重，[设备信息笔记](../feature/2026-10-08-android-device-info-copy.md)持有白名单复制，均继续保留并互链。iOS反向手势和横拖归属实现仅作相邻平台参考，不复用其UIKit方案。没有完全吸收或过时提案。

## Alternatives considered

- 等待更久或多次滑动：最小修改且可能让负载下的复制用例通过，但不能证明首次MOVE是否丢失，也会掩盖真实交互问题。
- 只删除`lastX`重置：可让后续MOVE补足位移，但仅一次MOVE时仍未消费交接事件，不能覆盖稀疏事件。
- 只按松手总位移翻页：实现简单，但手指拖动时网格仍不跟手，接手时就消费位移更直接。

## Verification

未改生产APK上的确定性稀疏横拖先失败；修复包SHA-256为`2d80d1de72091bc196c7fd9cea01fcf5411912f0ecfb96d0044400663977e8fb`。同一测试在API 28 `emulator-5566`及API 35 `emulator-5580`均实际通过，覆盖双向首段625px、后继50px不重复、慢速松手翻页、恰一次子控件取消且不松手点击、垂直归属及首尾边界和越界回拖。两个AVD均安装原生full瘦包，未启动Tauri产品。

`bash scripts/verify-local.sh --quick`退出0，包含Rust workspace、Android交叉编译及Java宿主检查；无关平台按作用范围跳过。原生APK构建、16KB对齐、依赖白名单、开发签名和`pnpm run verify-notes`通过。API 28首次核心套件通过新增回归后，在复制用例处以状态1退出且没有结果流；随后复制单项、以及连续“手势回归→复制”的两项均退出0并通过，未复现该无结果退出。API 28完整重跑通过手势、复制、候选、导出、辅助码和词库导入、分词拖选后，在数字键盘用例收到`Process crashed`。ActivityManager同时记录`installPackageLI`强停正在运行该instrumentation的产品进程，主机进程也显示另一会话在同一AVD运行装包；这是并发覆盖安装中断，不作为数字键盘产品缺陷或整套通过证据。没有再向被其他会话使用的AVD装包。

API 35的`smoke.sh emulator-5580 --core`退出0，安装、资源准备、输入、真实菜单复制、候选、导入、数字键盘、宿主导航、工具栏编辑、JNI句柄和剪贴板保存生命周期整套通过。另跑`MoreToolsDeviceSmoke`，首次在快捷栏准备阶段报告`IME showed []`，没有进入菜单断言；重新确认系统默认输入法稳定选中后，同一单项通过菜单排列、前后翻页、反馈开关、本地输入与AI子页、官网及返回键盘。未增加豁免或放宽断言。本片不宣称API 28整套通过，也没有真机验证。

独立只读审查无阻断，确认首段消费、触点同步、边界回拖与真实子项取消，以及manifest/source/core接线。`git diff --check`与笔记校验通过。

## Consequences

接手时滚动可能由首段位移一次推进较多，必须钳制到已有页范围并同步`lastX`，避免下一次事件重复计算。原复制失败是否还有布局或测试假设原因，需分别验证，不能由局部回归通过宣称整套装包成功。

## Initial evidence

旧产品APK的SHA-256为`d48e2a97cdfd7d495076d7ecfde41637ee0957113394a84c5ebb1225096e4b34`。原复制用例在上一片编译负载期间两次失败，本片空闲状态单项通过，临时截图探针也通过；探针已逐字撤回，不将这些通过当作修复证据。新增确定性设备回归从可点击子按钮发送DOWN及一次625px横向MOVE，安装产品实际失败为`first intercepted movement was lost: direction=1 scroll=0`，不是编译或夹具错误。确认此缺陷存在，但尚不能声称它是原复制失败的唯一原因。

复用既有安装产品反射测试模式（`SymbolPanelLayoutDeviceSmoke`），没有复制生产网格。边界和触摸归属留在Android原生视图，不进入共享Rust。[Android官方ViewGroup手势文档](https://developer.android.com/develop/ui/views/touch-and-input/gestures/viewgroup)及[AOSP ViewGroup](https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/view/ViewGroup.java)说明接手时对子控件发送CANCEL，后续事件才归父控件。接手事件的位移需在状态交接中保留，不能假定同一MOVE一定再次交给`onTouchEvent`。重复搜索、架构边界、既有生产测试模式与真实设备红测试共同支持此方案。
