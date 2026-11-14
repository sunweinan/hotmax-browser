const fs = require("node:fs");
const { WebContentsView } = require("electron");
const { TabRegistry } = require("./tabs.cjs");
const { ProfileStore, profileId } = require("./profiles.cjs");
const { NetworkMonitor } = require("./network.cjs");
const { homeUrl } = require("./config.cjs");
const path = require("node:path");

/** 连接窗口、标签、会话与命令分发；输入 BrowserWindow、runtime object、日志 function；返回控制器 object。 */
function createBrowserController(win, core, report) {
  let shuttingDown = false;
  const network = new NetworkMonitor();
  const profiles = new ProfileStore(core);
  const registry = new TabRegistry(win, sync, layout);
  /** 调整网页视图布局；无入参；返回 void。 */
  function layout() {
    if (!win || win.isDestroyed() || !registry) return;
    const [width, height] = win.getContentSize();
    for (const t of registry.items.values()) {
      if (!registry.live(t)) continue;
      const selected = t.id === registry.active;
      t.view.setVisible(selected);
      if (selected)
        t.view.setBounds({
          x: 0,
          y: 92,
          width: Math.max(1, width),
          height: Math.max(1, height - 92),
        });
    }
  }
  /** 发送可用标签快照；无入参；返回 void。 */
  function sync() {
    if (
      shuttingDown ||
      !win ||
      win.isDestroyed() ||
      win.webContents.isDestroyed() ||
      !registry
    )
      return;
    win.webContents.send("tabs", registry.snapshot());
  }
  /** 加载标签页面；输入标签 object 与 URL string；返回 Promise<void>。 */
  async function load(t, url) {
    try {
      await t.view.webContents.loadURL(url);
    } catch (e) {
      if (
        !registry.live(t) ||
        shuttingDown ||
        e.code === "ERR_ABORTED" ||
        e.errno === -3
      )
        return;
      t.error = e.message;
      report("navigation", e.message);
      throw e;
    } finally {
      sync();
    }
  }
  /** 创建持久化标签；输入 URL/profileId；返回 Promise<object>。 */
  async function open(p) {
    const idProfile = profileId(p.profileId);
    const ses = await profiles.get(idProfile);
    if (shuttingDown || !win || win.isDestroyed())
      throw new Error("浏览器正在退出");
    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        v8CacheOptions: "none",
      },
    });
    const t = registry.add(view, idProfile),
      id = t.id,
      wc = view.webContents;
    const events = [
      "did-navigate",
      "did-navigate-in-page",
      "page-title-updated",
      "did-start-loading",
      "did-stop-loading",
    ];
    const update = () => sync();
    const loaded = () => {
      t.error = null;
      sync();
    };
    wc.on("did-finish-load", loaded);
    for (const event of events) wc.on(event, update);
    const gone = (_, details) => {
      if (!registry.live(t) || shuttingDown) return;
      t.error = "页面进程退出，请刷新";
      report("renderer", details.reason);
      sync();
    };
    const destroyed = () => registry.close(id);
    wc.on("render-process-gone", gone);
    wc.on("destroyed", destroyed);
    t.cleanup = () => {
      for (const event of events) wc.removeListener(event, update);
      wc.removeListener("did-finish-load", loaded);
      wc.removeListener("render-process-gone", gone);
      wc.removeListener("destroyed", destroyed);
    };
    wc.setWindowOpenHandler(({ url }) => {
      open({ url, profileId: idProfile }).catch((e) => {
        if (!shuttingDown) report("popup", e.message);
      });
      return { action: "deny" };
    });
    let detachNetwork = () => {};
    try {
      detachNetwork = network.attach(wc, id);
    } catch (error) {
      report("network", error.message);
    }
    const cleanup = t.cleanup;
    t.cleanup = () => {
      detachNetwork();
      cleanup();
    };
    sync();
    await load(t, p.url ?? homeUrl);
    sync();
    return { tabId: id, profileId: idProfile };
  }
  /** 查找标签；输入 tabId/profileId；返回标签对象。 */
  function tab(p) {
    const t = p.tabId
      ? registry.items.get(String(p.tabId))
      : [...registry.items.values()].find(
          (t) => t.profileId === (p.profileId || "default"),
        );
    if (!registry.live(t)) throw new Error("标签已关闭");
    return t;
  }
  /** 执行浏览器控制；输入方法 string 与参数 object；返回 Promise<unknown>。 */
  async function dispatch(method, p = {}) {
    if (method === "open") return open(p);
    if (method === "tabs") return registry.snapshot();
    if (method === "network") return network.records;
    if (method === "activate") return registry.activate(p.tabId);
    if (method === "close") {
      const removed = registry.close(p.tabId);
      if (!registry.items.size && !shuttingDown)
        await open({ url: "about:blank" });
      return removed;
    }
    if (method === "quit") {
      setTimeout(() => win.close(), 100);
      return true;
    }
    if (method === "screenshot" && p.scope === "window") {
      const image = await win.capturePage();
      fs.writeFileSync(p.file, image.toPNG());
      return p.file;
    }
    if (method === "evaluate" && p.scope === "shell")
      return win.webContents.executeJavaScript(p.code, true);
    const t = tab(p),
      wc = t.view.webContents;
    if (method === "navigate") {
      t.error = null;
      await load(t, p.url);
      return true;
    }
    if (method === "back") {
      if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
      return true;
    }
    if (method === "forward") {
      if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
      return true;
    }
    if (method === "reload") {
      wc.reload();
      return true;
    }
    if (method === "evaluate") return wc.executeJavaScript(p.code, true);
    if (method === "response")
      return wc.debugger.sendCommand("Network.getResponseBody", {
        requestId: p.id,
      });
    if (method === "flush") {
      await profiles.flush(t.profileId);
      return true;
    }
    if (method === "screenshot") {
      const image = await wc.debugger.sendCommand("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      fs.writeFileSync(p.file, Buffer.from(image.data, "base64"));
      return p.file;
    }
    if (method === "request") {
      const headers = p.headers || {};
      if (p.transport === "page")
        return wc.executeJavaScript(
          `(async()=>{const r=await fetch(${JSON.stringify(p.url)},{...${JSON.stringify({ method: p.method || "GET", headers, body: p.body, credentials: "include" })},signal:AbortSignal.timeout(${JSON.stringify(p.timeout || 120000)})});return {status:r.status,body:await r.text()}})()`,
        );
      const r = await wc.session.fetch(p.url, {
        method: p.method || "GET",
        headers,
        body: p.body,
        credentials: "include",
        signal: AbortSignal.timeout(p.timeout || (p.file ? 1800000 : 120000)),
      });
      if (p.file) {
        fs.mkdirSync(path.dirname(p.file), { recursive: true });
        const { Readable } = require("node:stream");
        const { pipeline } = require("node:stream/promises");
        if (!r.ok) throw new Error("HTTP " + r.status);
        await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(p.file));
        return { status: r.status, file: p.file };
      }
      return { status: r.status, body: await r.text() };
    }
    throw new Error("未知浏览器方法 " + method);
  }

  /** 停止标签并保存所有会话；无入参；返回 Promise<void>。 */
  async function dispose() {
    shuttingDown = true;
    registry.dispose();
    await profiles.flushAll();
  }
  return { dispatch, layout, dispose };
}
module.exports = { createBrowserController };
