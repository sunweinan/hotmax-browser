import assert from "node:assert/strict";
import http from "node:http";
import { rpc } from "../src/runtime.js";
if (process.env.HOTMAX_BROWSER_TEST !== "1")
  throw new Error("请使用 npm run test:browser 启动隔离测试实例");
/** 等待本机浏览器状态条件成立；输入判断函数 function；返回 Promise<Tab[]>。 */
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    const tabs = await rpc("browser", "tabs");
    if (predicate(tabs)) return tabs;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("等待标签状态超时");
}
const original = (await rpc("browser", "tabs"))[0];
for (let i = 0; i < 25; i++) {
  const a = await rpc("browser", "open", { url: "about:blank" }),
    b = await rpc("browser", "open", {
      url: "data:text/html,<title>标签验证</title>OK",
    });
  await rpc("browser", "close", { tabId: a.tabId });
  assert.equal(
    (await rpc("browser", "tabs")).find((t) => t.active).id,
    b.tabId,
  );
  await rpc("browser", "close", { tabId: b.tabId });
}
const delayed = http.createServer((request, response) => {
  const timer = setTimeout(() => response.end("<title>延迟页面</title>"), 500);
  response.on("close", () => clearTimeout(timer));
});
await new Promise((resolve) => delayed.listen(0, "127.0.0.1", resolve));
try {
  const before = new Set((await rpc("browser", "tabs")).map((t) => t.id));
  const opening = rpc("browser", "open", {
    url: `http://127.0.0.1:${delayed.address().port}`,
  });
  const loadingTabs = await until((t) => t.some((x) => !before.has(x.id)));
  await rpc("browser", "close", {
    tabId: loadingTabs.find((t) => !before.has(t.id)).id,
  });
  await opening;
} finally {
  delayed.closeAllConnections();
  await new Promise((resolve) => delayed.close(resolve));
}
await rpc("browser", "back", { tabId: original.id });
await rpc("browser", "evaluate", {
  scope: "shell",
  code: 'document.querySelector(".tab-close").click();true',
});
const tabs = await until(
  (t) =>
    t.length === 1 && t[0].id !== original.id && t[0].url === "about:blank",
);
await rpc("browser", "close", { tabId: original.id });
assert.equal((await rpc("browser", "tabs"))[0].id, tabs[0].id);
await rpc("browser", "navigate", {
  tabId: tabs[0].id,
  url: original.url || "about:blank",
});
console.log(
  JSON.stringify({
    openCloseCycles: 25,
    closedBackgroundPreservesSelection: true,
    lastTabReplaced: true,
    closeWhileLoadingSafe: true,
    duplicateCloseSafe: true,
  }),
);
