# Agent Note: Android 工具栏一键发送刚复制的图片

Status: implemented

## Problem

#6781：用户在别的应用里复制了一张图片，回到聊天输入框想发出去，键盘没有任何入口。工具栏的「最近复制」（[最近复制的文字](2026-10-08-android-recent-clip-toolbar.md)）只认 `text/plain` 和 `text/html`，`readPrimaryClip` 对图片返回 null，Android 宿主里也没有任何地方调用 `commitContent`，键盘根本没有把图片交给输入框的能力。微信输入法在这种场景下会在顶栏显示这张图，点一下发送。

## Decision

只做本机这一部分（第一期），跨设备的图片另行评估。

- **同一个「最近复制」**：`RecentClipboardSuggestion` 多一种状态，复制的是图片时记身份和具体图片类型（`offerImage`），不记 URI，也不碰图片内容。显示窗口（60 秒）、点过或关掉后同一条不再出现、开始打字就收起，这些规则与文字一模一样；文字和图片同一时刻至多一条，后到的替换先到的。开关也是同一个：剪贴板历史开着且本地设置 `platform.android.clipboard_suggestion` 开着才提供（设置页「工具栏显示最近复制」的说明写明文字和图片都归它管，否则想关掉图片的用户看不出该关哪一项），隐私模式、密码类和不许个性化学习的输入框不提供，系统标为敏感（`EXTRA_IS_SENSITIVE`）的图片直接丢弃。图片从不写进剪贴板历史。
- **只在收得下的输入框里出现**：`render` 里经 `recentImageSendable` 判断，当前输入框的 `EditorInfo.contentMimeTypes` 声明收这种类型（规则同 `ClipDescription.compareMimeTypes`，`ClipboardImagePolicy.accepts`）才把这一行换成「发送复制的图片」。不声明的输入框里不显示，也不提示；图片仍在系统剪贴板上，长按输入框粘贴照样能用。是否显示按当前输入框实时判断：在不收图片的输入框里复制，切到收图片的输入框，一分钟内这一行会出现。
- **发送的是缓存副本**：点按时 `sendRecentImage` 先在主线程核对剪贴板里还是同一张（身份一致、没有被清空或换掉、不敏感），再在 `clipboardImageWorker` 上把图读进 `cache/clipboard-images/`（`ClipboardImageCache.replace`，上限 20 MB，超过就不发并提示粘贴），回到主线程经本应用的 FileProvider（`${applicationId}.files`，`res/xml/msime_file_paths.xml` 新增 `clipboard-images`）拿到 content URI，用 `InputConnection.commitContent` 加 `INPUT_CONTENT_GRANT_READ_URI_PERMISSION` 交给输入框。读图期间换了输入框或收起了键盘（`clipboardImageGeneration` 变了），这张不再发。读图这一步是系统边界：图片来自别的应用的 provider，它在 `openFile` 里抛的 `NullPointerException`、`IllegalStateException` 等会经 binder 原样抛到 worker 上，所以 worker 除了 IOException 还接住全部 RuntimeException，一律提示「无法读取复制的图片」；漏掉一个，未捕获异常会让整个 `:ime` 进程崩掉。
- **副本的扩展名决定收图应用看到的类型**：FileProvider 的 `getType` 只按文件扩展名经 `MimeTypeMap` 反查，查不到就是 `application/octet-stream`。所以扩展名先取 `MimeTypeMap.getExtensionFromMimeType`，系统表不认时用 `ClipboardImagePolicy.extension` 的几种常见写法补位（`image/jpg` 靠它），最后再反查一遍，反查出来不是图片的类型不提供发送（`clipboardImageExtension`，`recentImageSendable` 的一部分）。最初未知类型一律存成 `.img`，结果 `image/avif`、`image/tiff` 这类图在 commitContent 里声明的是图片，按 `ContentResolver.getType` 校验的应用拿到的却是 `application/octet-stream`。
- **副本不久留**：目录里至多一张，写新的之前先删旧的；发出 5 分钟后删掉（`ClipboardImagePolicy.RETENTION_MS`），输入框没收下时立刻删，键盘进程启动和 `onDestroy` 时清空。
- **不用 androidx 的 compat 类**：minSdk 是 28，`commitContent`、`InputContentInfo` 和 `EditorInfo.contentMimeTypes` 都是 API 25 起的平台接口，服务直接用。FileProvider 只有 androidx 有，`ClipboardImageCache.contentUri` 按名字反射调用 `FileProvider.getUriForFile`，理由和 `HandwritingRecognizerFactory` 对 ML Kit 一样：`check-host.sh` 的 JVM 冒烟只用 android.jar 编译不引用 androidx 的源文件，服务一旦 import FileProvider 就会整个被排除在那一步之外。release 构建不开 R8，类名不会被改掉。
- **跨进程**：键盘在 `:ime` 进程，FileProvider 声明在主进程。两者同一个 uid、同一个数据目录，`getUriForFile` 只读 provider 元数据并按同一个缓存目录算路径；收图的应用打开 URI 时系统按需拉起主进程。

## Alternatives considered

- **把剪贴板里的原 URI 直接交给输入框** — 不用复制、不写缓存，隐私上最干净。不用的原因是授权链断在键盘这里：键盘读剪贴板时系统给的是临时读权限，只授给键盘自己，`commitContent` 的授权只能转授键盘自己 provider 的 URI，转出去的别人的 URI 输入框打不开。
- **输入框不收图片时也显示，点了提示「长按粘贴」** — 这样在不声明 `contentMimeTypes` 的应用里（微信、QQ 是否声明还没在真机上确认）用户至少知道有这个功能。不用的原因是这一行会盖住工具栏的品牌菜单、表情、常用语等按钮一分钟，换来的只是一句告诉用户「这里用不了」的提示；产品决定是不收就不显示。
- **工具栏上显示缩略图、点按先预览，再「发送」或「保存到相册」（微信输入法的做法）** — 更直观。第一期不做：缩略图意味着用户还没点就打开图片读内容；保存到相册要写 MediaStore，API 28 还要存储权限。
- **单独一个「图片快捷发送」开关** — 图片可能比文字更敏感，单独的开关让用户只关图片。不用的原因是现在的开关已经要求剪贴板历史开着，用户关掉历史就是不想让键盘碰复制的内容，文字和图片在这一点上没有区别；多一个开关只是多一个要解释的设置。
- **用 androidx 的 `InputConnectionCompat` / `EditorInfoCompat`** — 官方推荐写法，能覆盖 API 25 以下。minSdk 28 用不到兼容部分，服务引入 androidx 还会让它离开 JVM 冒烟的编译范围，见上。

## Consequences

- **收益**：在声明收图片的输入框里，复制图片后切回去一次点按就发出；文字的「最近复制」行为不变。
- **代价与已知上限**：输入框不声明 `contentMimeTypes` 时整个功能看不见，如果微信、QQ 的聊天框不声明，issue 里提出的场景仍然只能长按粘贴；那时要重访「不收就不显示」这一条。发出的副本在缓存里最多留 5 分钟，读得比这更慢的应用会读不到。超过 20 MB 的图不发。系统 `MimeTypeMap` 不认的图片类型（例如老版本系统上的 AVIF）不提供发送，只能长按粘贴。复制时只有图片、同时带文字的剪贴板项按文字处理。跨设备的图片（云剪贴板只收文字，服务端要存图片）不在这一期。

## Verification

`platforms/android/tests/clipboard/ClipboardImagePolicySmoke.java` 验证类型选择、未知类型不给扩展名、`accepts` 的通配与不声明即不收、20 MB 上限、副本替换与清理、超限和空内容不留半成品；`RecentClipboardSuggestionSmoke` 增加图片状态的提供、过期、关掉后不再出现、文字与图片互相替换。`bash platforms/android/check-host.sh` 编译并运行它们，另有源码守卫要求 `offerRecentClip` 对图片同样丢弃敏感内容、`render` 只在 `recentImageSendable` 为真时显示、`recentImageSendable` 要求副本扩展名反查仍是图片、发送走 `ClipboardImageCache.contentUri` 并带读权限、`msime_file_paths.xml` 暴露 `clipboard-images`。设备上由 `platforms/android/tests/device/clipboard/ClipboardImageDeviceSmoke.java`（`smoke.sh` 的一个套件）验收：合成编辑器经自己的不导出 provider 把一张 PNG 放进剪贴板，收图片的输入框里出现「发送复制的图片」，点按后输入框收到的类型、provider 按副本扩展名报出的类型（`ContentResolver.getType`）、字节数和 SHA-256 与原图一致，键盘缓存里恰好一份 PNG 副本；不收图片的输入框里不出现；回到收图片的输入框又出现。它在 API 35（`smoke.sh` 全套）和 API 28（`smoke.sh --core` 之后单独运行）的专用 AVD 上都通过；`--core` 本身不跑它。这一行的出现和收起要绕过 UiAutomation 的节点缓存来查（`findFresh`），API 28 上输入法窗口的内容变化不会让缓存失效。未在真机上验证：微信、QQ 等应用的聊天框是否声明 `contentMimeTypes`，以及 ColorOS 等厂商系统对剪贴板图片的限制。
