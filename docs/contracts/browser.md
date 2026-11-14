# 控制契约

## CLI

```text
hotmax-browser <method> [JSON | @file.json | -]
```

参数必须是 JSON 对象；`@` 从 UTF-8 文件读取（允许 BOM），`-` 从 stdin 读取。成功时 stdout 输出 JSON，退出码为 0；失败时 stderr 输出 `{ "error": { "code", "message" } }`，退出码为 1。帮助、版本和 endpoint 命令输出普通文本。

## 传输

macOS 通过 Unix socket、Windows 通过命名管道传输，每条连接处理一条请求：

```json
{"method":"tabs","params":{}}
```

以换行结尾。响应为 `{"result":...}` 或 `{"error":{"message":"...","code":"..."}}`，同样以换行结尾，然后关闭连接。params 可省略；请求上限为 16 MiB。客户端超时为 180 秒，含 file 参数时为 30 分钟。

macOS 地址为系统临时目录中的 `cps-<ROOT 的 SHA256 前 12 位>-browser.sock`，权限为 `0600`，保留既有地址规则。Windows 地址为 `\\.\pipe\cps-<实例路径哈希前 12 位>-browser`，哈希前先用 Windows 路径规则归一化分隔符并转小写。

Windows 不对管道执行 chmod/unlink；最后一个句柄关闭后由系统回收。服务保持 readableAll/writableAll 为 false，访问受系统默认管道权限约束。两端需使用相同系统账户和用户空间。通过 `hotmax-browser endpoint` 获取实际地址，不应手写或删除活跃 socket。Windows 应用与 CLI 均使用 Windows 原生 Node.js；不直接从 WSL 的 Linux Node.js 连接命名管道。

系统传输规则见 [Node.js IPC 文档](https://nodejs.org/docs/latest-v22.x/api/net.html#ipc-support)。

## 标签与账户

标签 ID 是当前进程内的字符串。`tabs` 返回数组，每项包含 `id`、`profileId`、`url`、`title`、`active`、`canGoBack`、`canGoForward` 和 `error`。

`open` 的 profileId 默认是 `default`，允许 1–80 个 Unicode 字母、数字、下划线或连字符。Windows 不允许 CON、PRN、AUX、NUL、COM1–COM9、LPT1–LPT9 等系统保留设备名（含 ¹、²、³ 变体）。不同 profile 的 Cookie 与网站存储隔离；同一个 profile 的多个标签共享网站会话。

操作标签时优先传 tabId。省略时，页面级方法选择注册顺序中第一个匹配 profileId 的标签；profileId 默认是 default。`activate` 和 `close` 必须传 tabId。不应把 profileId 视为唯一的网站标识。

## 方法

| 方法 | 参数 | 结果 |
| --- | --- | --- |
| `tabs` | 无 | 标签快照数组 |
| `open` | `url?`、`profileId?` | `{tabId, profileId}`；加载完成后返回 |
| `activate` | `tabId` | `true` |
| `close` | `tabId` | 是否移除了标签；重复关闭返回 `false` |
| `navigate` | `tabId`、`url` | `true`；加载完成后返回 |
| `back` / `forward` / `reload` | `tabId` | `true`；导航动作发出后返回 |
| `evaluate` | `tabId`、`code`；可选 `scope:"shell"` | JavaScript 的可序列化结果，支持 Promise |
| `request` | `url`、`tabId`，其余见下文 | `{status,body}` 或 `{status,file}` |
| `network` | 无 | 最近最多 500 条请求元信息 |
| `response` | `tabId`、`id`（网络记录的 requestId） | Chromium 返回的 `{body,base64Encoded}` |
| `screenshot` | `tabId`、`file`；可选 `scope:"window"` | 写入 PNG 后返回文件路径 |
| `flush` | `tabId` 或 `profileId` | 会话持久化完成后返回 `true` |
| `quit` | 无 | `true`；随后保存会话并退出应用 |

截图默认捕获指定网页；`scope:"window"` 捕获外壳，在部分平台不包括原生子视图，不用于拼接完整浏览器画面。截图不会主动调用窗口聚焦。文件路径由本机调用方提供；截图的父目录需要已存在。

`evaluate` 可以执行有副作用的页面脚本；`scope:"shell"` 是控制外壳的高级接口，不提供给远程网页。调用方负责授权和审查脚本。返回整个 HTML 或响应正文可能包含大量内容和敏感信息，应按需选取字段。

## 请求与网络记录

request 可使用 `method`、`headers`、字符串 `body`、毫秒 `timeout`、`transport` 和 `file`。

- 默认 `transport:"session"`：使用指定 profile 的 Electron Session 发起请求。普通请求超时 120 秒，文件请求默认 30 分钟。file 模式创建父目录并流式保存响应，非 2xx 状态抛错。
- `transport:"page"`：在网页中执行 fetch，受该网页的 CORS 与 CSP 约束；超时默认 120 秒。返回文本正文，不支持 file 保存。
- request 不对所有 HTTP 错误自动重试；非文件请求将 HTTP 状态作为 status 返回。
- network 仅返回请求 ID、标签 ID、方法、时间、脱敏 URL，以及响应状态和 MIME 类型。请求头和正文不记录；URL 用户信息、片段和查询值不保留。URL 路径仍可能含业务标识。
- response 是显式读取原始响应正文的接口，其内容可能敏感。网页销毁、重载或 Chromium 缓存回收后，正文可能已不可用。

## 配置与存储

`paths.cjs` 统一解释用户空间：设置 HOTMAX_BROWSER_DATA_DIR 时使用其绝对路径，否则使用用户目录下的 .hotmax-browser（macOS：~/.hotmax-browser；Windows：%USERPROFILE%\.hotmax-browser）。ROOT=DATA=用户空间，TEMP=DATA/artifacts。路径不依赖源码位置，不读取业务项目路径。`config.cjs` 从 DATA/config.json 读取用户权限配置。

Cookie 快照为 `DATA/profiles/<profileId>/session-cookies.json`，内容为未加密 JSON；macOS 权限为 0600，Windows 使用用户目录继承的文件 ACL。登录所需的 Chromium Cookie、Local Storage、IndexedDB 位于同一 profile 目录。运行错误位于 DATA/browser-errors.log。这些用户数据与源码、应用包和发布归档分离。JSON 存储先写入同目录临时文件，使用可写句柄刷新后关闭，再重命名替换；读取允许 UTF-8 BOM。

启动页使用显式 HOTMAX_BROWSER_HOME 或默认 https://hotmax.chat。open 省略 url 时打开默认 Hotmax 首页；新建标签与关闭最后一页显示 about:blank。没有标签恢复逻辑，也不根据之前访问的网站改变首页。省略 tabId 时始终按注册顺序选择该 profile 的第一个可用标签，不按网站特殊选择。

用户配置只处理 permissions：以完整 origin 映射 Electron 权限名称数组，未配置的权限请求和检查均拒绝。业务认证头由调用方通过 request.headers 显式传入。

### 缓存策略

- profile 会话通过 cache:false 创建，启动参数同时关闭 HTTP 缓存；网页与外壳使用 v8CacheOptions:none。
- profile 初始化和正常退出时清理 HTTP 缓存、代码缓存、共享压缩字典缓存、shadercache、serviceworkers、cachestorage。
- Cookie、localstorage、indexdb 不在清理列表，保留登录态。网站可能在这些存储中同时保存设置与业务数据，浏览器不按字段猜测用途。
- 外壳使用不持久化 partition，sessionData 指向系统临时目录；正常退出清理该目录。崩溃残留缓存于下次加载 profile 时清理，不恢复旧网页。
- network 记录只存在于本次进程的内存，不落盘。

## 生命周期与错误

关闭标签先更新注册表，再解绑事件和释放网页。关闭最后一页创建空白标签。页面成功加载会清空此前的导航错误；前进、后退和刷新是异步动作，调用方应通过 tabs 或 evaluate 检查结果。

退出时等待 Cookie 写入队列与网站存储刷新、清理普通缓存，再关闭控制服务。页面退出后不得读取已销毁对象。标签栏为 44px，地址栏为 48px，网页视图从内容区 y=92 开始。macOS 标签栏左侧为窗口按钮预留 88px，Windows 使用原生标题栏，标签栏左侧为 12px；系统标题栏不计入网页视图的内容区坐标。
