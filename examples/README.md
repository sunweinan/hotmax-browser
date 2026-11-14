# 示例

先启动浏览器，用 `tabs` 或 `open` 获取实际 tabId，然后修改 JSON 文件中的 tabId。

```sh
node bin/hotmax-browser.js evaluate "@examples/read-page.json"
```

文件参数同时适用于 macOS、Windows PowerShell 和命令提示符，避免内联 JSON 的终端转义差异。

该示例只读取标题、主标题与 main 中前十个链接，避免无差别返回整页 HTML。没有 main 或 h1 的页面会返回空列表或省略对应字段。

从 Node.js 直接调用同一协议：

```js
import { rpc } from "./src/runtime.js";

const { tabId } = await rpc("browser", "open", { url: "https://hotmax.chat" });
const result = await rpc("browser", "evaluate", {
  tabId,
  code: "({title:document.title,url:location.href})",
});
console.log(result);
```

文件中的 import 以仓库根目录为基准，实际项目应调整为正确的相对路径。
