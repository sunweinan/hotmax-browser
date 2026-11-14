# Hotmax Browser 开发约定

- 默认中文。修改前读 README、package.json、docs/architecture.md 和 docs/contracts/browser.md。
- 控制器、标签与会话模型、外壳视图、传输层分别负责本层职责；不向浏览器核心加入特定网站的业务代码。
- 方法、类和封装使用简短注释说明职责、入参和返回类型。注释记录当前契约，不记录修改轮次、对话过程或已经失效的实现。
- 接口、状态、路径、权限、配置和命令变更时，同步上下游、相关文档和有意义的测试。
- `config.cjs` 读取用户空间的 config.json；`paths.cjs` 是存储与实例路径的唯一解释入口，主进程和 CLI 必须共用它。
- 用户配置、Cookie、网站存储、真实请求数据、私钥和本机绝对路径不得进入公开源码。
- 默认只打开 Hotmax 首页，不保存或恢复标签列表；不按业务网站特殊选择标签。
- 用户空间默认 ~/.hotmax-browser，独立于源码和业务项目。禁用 HTTP/脚本磁盘缓存，加载和退出时清理普通缓存，保留 Cookie、Local Storage、IndexedDB。
- 关闭标签先移出注册表、解绑事件，再释放网页；应用退出须等待会话保存和缓存清理。
- 网页不加载外壳 preload；保持 sandbox、contextIsolation，关闭 nodeIntegration。只接收本地外壳 IPC。
- 面向 macOS 和 Windows 维护一份源码；Windows 使用命名管道，macOS 保持 Unix socket 地址兼容。Windows 管道不执行 chmod/unlink，不开启所有用户读写；不新增网络监听服务。
- Windows 实例地址对路径分隔符和大小写归一化；用户空间仍由 paths.cjs 决定。JSON 文件与 CLI 输入支持 UTF-8 BOM。
- Git 文本默认使用 LF，Windows .cmd 工作区文件使用 CRLF；通过 .gitattributes 统一换行规则。
- Windows 使用原生标题栏，macOS 标签栏为系统窗口按钮预留位置；两者网页视图都从内容区 y=92 开始。
- 优先修改现有样式，保持窄窗口可用；页面脚本和截图不主动抢占系统焦点。
- 集成测试必须创建独立数据目录，不操作用户正在使用的账户和标签。
- 源码与应用包从发布白名单生成；依赖变化后核对第三方许可和应用内的运行时声明。
- 目录地图：src 为实现，bin 为命令入口，test 为测试，docs 为技术文档，examples 为示例，scripts 为发布工具，assets 为品牌资源。
