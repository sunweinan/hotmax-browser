# 发布指南

## 源码发布

项目以一份源码供 macOS 和 Windows 用户自行安装依赖、启动，不要求发布安装包。

GitHub 仓库以本工具目录为根目录。不要上传上级工作区，也不要直接压缩整个工作目录。

```sh
npm ci
npm run release:source
```

源码包输出为 `dist/hotmax-browser-<version>-source.tar.gz`，旁边包含 SHA-256 文件。脚本按明确白名单复制源码、测试、文档和品牌资源，不包含用户配置、node_modules、账户目录或其他构建产物。

源码仓库保留 package-lock.json。更新依赖后运行 `npm audit`，核对 Electron 支持状态，重新运行测试并检查第三方许可。

## 可选的本地应用构建

源码运行无需构建应用目录。需要本地独立运行目录时，先安装依赖，然后在目标系统执行（Windows 使用 npm.cmd）：

```sh
npm run package
```

只构建当前 macOS/Windows 平台与 CPU 架构，不生成安装程序。输出位于 `dist/apps/`；macOS 为 `.app`，Windows 为包含 `.exe` 及配套运行时的目录，须保留整个目录。用户空间中的配置和登录数据不会进入应用包。应用默认使用 `~/.hotmax-browser`，与相同设置的 CLI 共用实例。

应用资源包含 Electron LICENSE、LICENSES.chromium.html 和本项目 THIRD_PARTY_NOTICES.md；不要删除这些文件。它们覆盖随 Electron 分发的 Chromium、Node.js 和其他组件声明。本项目的 MIT 许可不替代第三方许可。

本地包未签名、公证，也没有自动更新服务。macOS 对外分发应完成开发者签名和公证；分别验证 Apple Silicon/Intel 等目标架构。Windows 应在实际目标系统验证启动、CLI 与用户存储。不要仅依据本机打包成功声明支持所有系统。

## GitHub 仓库资料

仓库：[sunweinan/hotmax-browser](https://github.com/sunweinan/hotmax-browser)。

简介：开源 AI 浏览器与浏览器自动化工具，面向 Codex、AI Agent 和 AI 编程助手。通过 CLI、JavaScript、DOM 实现浏览器控制、网页交互、数据提取、自动填表和工作流自动化，不占用系统鼠标。Open-source AI browser, browser automation, browser control, AI assistant tools, web scraping, form automation and workflow automation. macOS / Windows.

Topics：`browser`、`electron`、`cli`、`automation`、`javascript`、`ai-agent`、`macos`、`windows`、`ai-browser`、`browser-automation`、`web-automation`、`ai-agents`、`codex`、`dom`、`web-scraping`、`form-automation`、`ai-assistant`、`browser-control`、`workflow-automation`、`developer-tools`。

根 README 自动成为 GitHub 项目介绍页，无需单独部署网站。仓库包含贡献指南、安全说明、行为准则、Issue/PR 模板和 CI；上传后可在 GitHub 的 Community Standards 页面检查识别结果。

维护者向仓库推送版本，其他贡献者通过 Fork 和 Pull Request 提交变更。推送前核对暂存文件，确保本机配置、密钥、Cookie 和运行数据不在其中。

## 发布版本

1. 同步 package.json、package-lock.json 和 CHANGELOG.md 的版本。
2. 标明支持范围及实际验证状态；未运行的平台不标为已验收。
3. 在仓库设置中启用私密漏洞报告；为维护者设置合适的分支保护。
4. 创建形如 `v1.2.0` 的标签，在 GitHub Releases 填写版本说明。
5. 附上源码包及校验值，或直接提供仓库源码下载；不要求上传应用包。
6. 在说明中列出实际验证的平台与架构，明确签名状态和已知边界。

`.github/workflows/ci.yml` 仅在 GitHub Actions 页面手动触发，推送与 PR 不自动运行测试。工作流不推送代码、不上传正式 Release，也不自动公开仓库。
