# 安装与使用

## 环境

- macOS 或 Windows 桌面；源码运行需要 Node.js 22.12+ 和 npm。
- 安装依赖时需要联网下载对应平台的 Electron 运行时。
- Windows 使用原生 Node.js、PowerShell 或命令提示符；浏览器与 CLI 在同一系统账户下运行。
- 这是桌面应用，不是网站服务器；无需数据库或开放公网端口。

## 从源码启动

下载仓库源码，解压后进入含 package.json 的目录。macOS 终端：

```sh
npm ci
npm start
```

Windows PowerShell 或命令提示符：

```powershell
npm.cmd ci
npm.cmd start
```

`npm.cmd` 直接调用 npm 的 Windows 命令入口，不需要调整 PowerShell 执行策略。安装 Node.js 后应重新打开终端，使 PATH 生效。

首次安装依赖后，macOS 可以双击 `启动浏览器.command`，Windows 可以双击 `start-windows.cmd`。启动脚本以自身所在目录运行，支持目录名包含空格。浏览器默认打开 Hotmax 首页，点击“＋”创建空白标签。

项目提供源码，运行时不需要安装包。不要把 macOS 的 node_modules 复制到 Windows；各系统分别运行安装命令取得对应依赖。

macOS Apple Silicon 已运行验证；Windows 尚未进行实机验证。可选的本地应用目录构建见 [发布指南](releasing.md)。

## 连接与调用

先启动浏览器，再在源码目录的另一个终端中执行：

```sh
node bin/hotmax-browser.js tabs
node bin/hotmax-browser.js open "@examples/open-page.json"
```

`examples/open-page.json` 定义网址与 profile，可按需修改。`open` 返回 `tabId`，将它填入 `examples/read-page.json` 后执行：

```sh
node bin/hotmax-browser.js evaluate "@examples/read-page.json"
```

文件参数写法适用于 macOS、PowerShell 和 Windows 命令提示符。所有带参数的命令都可通过 `@file.json` 传入 JSON 对象，UTF-8 文件允许带 BOM。

macOS 终端也可以直接传 JSON：

```sh
node bin/hotmax-browser.js reload '{"tabId":"2"}'
node bin/hotmax-browser.js close '{"tabId":"2"}'
```

`2` 仅为示例，必须替换为真实 ID。标签 ID 仅在本次浏览器进程中有效。

命令返回 JSON，错误输出到 stderr 并返回非零退出码。`--help`、`--version` 和 `endpoint` 输出普通文本。

macOS 终端还可以通过标准输入调用：

```sh
cat examples/read-page.json | node bin/hotmax-browser.js evaluate -
```

不要把密码放进命令行参数或提交到示例文件。敏感操作由调用工具负责获得用户授权。

## 与编程助手协作

为具备终端执行能力的编程助手提供仓库路径和下面的操作约定即可，无需屏幕控制插件：

```text
通过 node bin/hotmax-browser.js 操作浏览器。
先 tabs 或 open 获取 tabId，之后显式传递 tabId。
用 evaluate 读取需要的 DOM 字段并返回简短 JSON。
优先使用页面元素的稳定属性、表单标签和语义，不依赖屏幕坐标。
改变页面状态后重新读取结果。不要输出 Cookie、令牌或完整私密页面。
```

例如页面中的按钮存在稳定 ID 时：

```json
{
  "tabId": "2",
  "code": "document.querySelector('#load-more')?.click(); ({clicked:!!document.querySelector('#load-more')})"
}
```

该示例只说明调用方式，实际操作必须使用目标页面真实存在的选择器，并验证操作结果。

## 独立实例

在两个终端中使用相同的数据目录。macOS：

```sh
# 终端一
HOTMAX_BROWSER_DATA_DIR="$HOME/.hotmax-demo" npm start

# 终端二
HOTMAX_BROWSER_DATA_DIR="$HOME/.hotmax-demo" node bin/hotmax-browser.js tabs
```

Windows PowerShell：

```powershell
# 终端一
$env:HOTMAX_BROWSER_DATA_DIR = Join-Path $env:USERPROFILE ".hotmax-demo"
npm.cmd start

# 终端二
$env:HOTMAX_BROWSER_DATA_DIR = Join-Path $env:USERPROFILE ".hotmax-demo"
node bin/hotmax-browser.js tabs
```

需要保留账户时，选择自己用户目录下的持久目录。Windows 应用与 CLI 使用 Windows 原生 Node.js；WSL 内的 Linux Node.js 不直接连接 Windows 命名管道。

更改启动页，macOS：

```sh
HOTMAX_BROWSER_HOME=https://example.com npm start
```

Windows PowerShell：

```powershell
$env:HOTMAX_BROWSER_HOME = "https://example.com"
npm.cmd start
```

## 本机配置与权限

用户空间默认为 macOS 的 `~/.hotmax-browser` 或 Windows 的 `%USERPROFILE%\.hotmax-browser`；配置文件为该目录中的 `config.json`。可将源码中的 `config.example.json` 复制到这个位置，设置 `HOTMAX_BROWSER_DATA_DIR` 时则放到指定用户目录。源码运行与应用包使用相同规则，用户配置不放在源码或应用内部。

默认拒绝网站权限请求。需要允许某个可信来源使用特定权限时，可在本机配置中填写完整 origin：

```json
{
  "permissions": {
    "https://example.com": ["media"]
  }
}
```

`media` 包括音视频采集，系统本身仍可能要求授权。只为需要的来源填写权限；权限名遵循 Electron Session API。变更后重启生效。目前没有权限管理界面。

## 登录数据与缓存

```text
~/.hotmax-browser/
  config.json                         用户权限配置
  profiles/<profileId>/               Cookie、Local Storage、IndexedDB
    session-cookies.json              会话 Cookie 快照
  artifacts/                          调用方显式保存的产物目录
  browser-errors.log                  本机运行错误
```

浏览器不保存或恢复标签列表。启动页只由默认首页或显式 HOTMAX_BROWSER_HOME 决定。用户或业务脚本仍可正常导航、打开其他网页。

HTTP 缓存关闭，网页脚本不生成 V8 磁盘缓存。账户加载和正常退出时清理已有 HTTP 缓存、代码缓存、压缩字典缓存、着色器缓存、Service Worker 和 Cache Storage；外壳的会话使用临时目录，正常退出后移除。异常终止留下的缓存会在下次加载该账户时清理。

保留 Cookie、Local Storage 和 IndexedDB，避免清理掉网站的登录凭证。网站也可能在这些存储中放置设置或业务数据，浏览器不能通用地判断每个字段是否仅用于登录。离线页面缓存不会跨正常退出保留。

## 常见问题

**CLI 无法连接：** 确认应用已启动；用 `endpoint` 查看连接地址；检查两端的 `HOTMAX_BROWSER_DATA_DIR` 与本机配置是否一致。macOS 不要删除正在使用的 socket；Windows 请在原生终端使用相同的系统账户连接。

**页面看起来正常但脚本选错标签：** 使用 `tabs` 查看最新 ID，再显式传递 `tabId`。不要把 profile 当作唯一的网页标识。

**网站不接受 DOM 操作：** Canvas、跨来源 iframe、原生对话框和网站防自动化机制可能需要不同方案。Hotmax Browser 不承诺绕过这些边界。

**关闭后登录失效：** 登录状态由网站的有效期与服务端规则共同决定。浏览器会保存 Cookie 和网站存储，但无法延长服务端已撤销的会话。
