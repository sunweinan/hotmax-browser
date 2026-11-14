import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "hotmax-browser-test-"),
);
process.env.HOTMAX_BROWSER_DATA_DIR = directory;
process.env.HOTMAX_BROWSER_TEST = "1";
delete process.env.ELECTRON_RUN_AS_NODE;
const { rpc } = await import("../src/runtime.js");
const electron = createRequire(import.meta.url)("electron");
let child;
let failPage = true;
let cachedRequests = 0;
const log = fs.openSync(path.join(directory, "electron.log"), "a");

/** 等待异步页面状态；输入检查 function；返回 Promise<unknown>。 */
async function until(check) {
  let error;
  for (let i = 0; i < 100; i++) {
    try {
      const result = await check();
      if (result) return result;
    } catch (value) {
      error = value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw error || new Error("等待浏览器状态超时");
}

/** 启动本测试的独立浏览器；输入首页 string；返回 Promise<void>。 */
async function start(url) {
  child = spawn(electron, ["src/main.cjs"], {
    env: { ...process.env, HOTMAX_BROWSER_HOME: url },
    stdio: ["ignore", log, log],
  });
  await until(async () =>
    (await rpc("browser", "tabs")).some((tab) => tab.url === url),
  );
}

/** 退出测试进程，必要时终止该子进程；无入参；返回 Promise<void>。 */
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  await rpc("browser", "quit").catch(() => child.kill());
  const timer = setTimeout(() => child.kill(), 5000);
  await exited;
  clearTimeout(timer);
}

const server = http.createServer((request, response) => {
  if (request.url === "/cacheable") {
    cachedRequests++;
    response.setHeader("Cache-Control", "public, max-age=31536000");
    response.end(String(cachedRequests));
    return;
  }
  if (request.url === "/retry" && failPage) {
    request.socket.destroy();
    return;
  }
  if (request.url === "/echo") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ cookie: request.headers.cookie || "" }));
    return;
  }
  response.end(
    `<title>${request.url}</title><main>Browser test</main><a target="_blank" href="/popup">popup</a><input type="file">`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  await start(origin + "/start");
  await new Promise((resolve, reject) => {
    const smoke = spawn(process.execPath, ["test/smoke.js"], {
      env: process.env,
      stdio: "inherit",
    });
    smoke.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("标签测试失败")),
    );
  });
  const tab = await rpc("browser", "open", {
    url: origin + "/first",
    profileId: "test-a",
  });
  await rpc("browser", "navigate", { ...tab, url: origin + "/second" });
  await rpc("browser", "back", tab);
  await until(
    async () =>
      (await rpc("browser", "tabs")).find((t) => t.id === tab.tabId)?.url ===
      origin + "/first",
  );
  await rpc("browser", "forward", tab);
  await until(
    async () =>
      (await rpc("browser", "tabs")).find((t) => t.id === tab.tabId)?.url ===
      origin + "/second",
  );
  await rpc("browser", "evaluate", {
    ...tab,
    code: 'document.cookie="test_cookie=present; path=/";localStorage.setItem("test", "saved");true',
  });
  const second = await rpc("browser", "open", {
    url: origin + "/third",
    profileId: "test-a",
  });
  assert.equal(
    await rpc("browser", "evaluate", {
      profileId: "test-a",
      code: "location.pathname",
    }),
    "/second",
  );
  await rpc("browser", "close", second);
  const counts = await rpc("browser", "evaluate", {
    ...tab,
    code: '(async()=>{const first=await (await fetch("/cacheable")).text();const second=await (await fetch("/cacheable")).text();return [first,second]})()',
  });
  assert.deepEqual(counts, ["1", "2"]);
  await rpc("browser", "evaluate", {
    ...tab,
    code: '(async()=>{const cache=await caches.open("offline-test");await cache.put("/offline",new Response("temporary"));return true})()',
  });
  for (const transport of ["session", "page"]) {
    const response = await rpc("browser", "request", {
      ...tab,
      url: origin + "/echo",
      transport,
    });
    assert.equal(response.status, 200);
    assert.match(response.body, /test_cookie=present/);
  }
  const other = await rpc("browser", "open", {
    url: origin,
    profileId: "test-b",
  });
  assert.equal(
    await rpc("browser", "evaluate", { ...other, code: "document.cookie" }),
    "",
  );
  await rpc("browser", "evaluate", {
    ...tab,
    code: 'document.querySelector("a").click();true',
  });
  assert.equal(
    (
      await until(async () =>
        (await rpc("browser", "tabs")).find((t) => t.url === origin + "/popup"),
      )
    ).profileId,
    "test-a",
  );
  await assert.rejects(
    rpc("browser", "navigate", { ...tab, url: origin + "/retry" }),
  );
  failPage = false;
  await rpc("browser", "reload", tab);
  await until(
    async () =>
      (await rpc("browser", "evaluate", { ...tab, code: "document.title" })) ===
      "/retry",
  );
  assert.equal(
    (await rpc("browser", "tabs")).find((t) => t.id === tab.tabId).error,
    null,
  );
  await rpc("browser", "screenshot", {
    ...tab,
    file: path.join(directory, "page.png"),
  });
  assert.ok(fs.statSync(path.join(directory, "page.png")).size > 100);
  await rpc("browser", "evaluate", {
    ...tab,
    code: 'fetch("/echo?token=synthetic-secret",{method:"POST",body:"synthetic-secret"}).then(()=>true)',
  });
  const network = await rpc("browser", "network");
  assert.equal(JSON.stringify(network).includes("synthetic-secret"), false);
  await stop();
  await start("about:blank");
  assert.equal((await rpc("browser", "tabs")).length, 1);
  assert.equal((await rpc("browser", "tabs"))[0].url, "about:blank");
  const restored = await rpc("browser", "open", {
    url: origin,
    profileId: "test-a",
  });
  const storage = await rpc("browser", "evaluate", {
    ...restored,
    code: '({cookie:document.cookie,value:localStorage.getItem("test")})',
  });
  assert.match(storage.cookie, /test_cookie=present/);
  assert.equal(storage.value, "saved");
  assert.deepEqual(
    await rpc("browser", "evaluate", { ...restored, code: "caches.keys()" }),
    [],
  );
  console.log(
    "通过：导航、标签、错误恢复、会话隔离、请求、网络脱敏、截图、首标签选择、禁用 HTTP 缓存、离线缓存清理与登录持久化",
  );
} finally {
  await stop();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.closeSync(log);
  if (process.env.HOTMAX_KEEP_TEST_DATA === "1") console.log(directory);
  else fs.rmSync(directory, { recursive: true, force: true });
}
