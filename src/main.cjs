const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { appName, homeUrl, browserRoot } = require("./config.cjs");
const { DATA } = require("./paths.cjs");
const { createBrowserController } = require("./browser.cjs");

fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });
const sessionData = fs.mkdtempSync(path.join(os.tmpdir(), "hotmax-session-"));
app.setName(appName);
if (process.platform === "win32") app.setAppUserModelId("chat.hotmax.browser");
app.setPath("userData", DATA);
app.setPath("sessionData", sessionData);
app.commandLine.appendSwitch("disable-http-cache");
app.on("quit", () => fs.rmSync(sessionData, { recursive: true, force: true }));
let win, controller, server;
let exiting = false;
let flushed = false;

/** 写入结构化运行日志；输入 context string、message string；返回 void。 */
function report(context, message) {
  fs.appendFileSync(
    path.join(DATA, "browser-errors.log"),
    JSON.stringify({
      at: new Date().toISOString(),
      context,
      message,
    }) + "\n",
    { mode: 0o600 },
  );
}

/** 启动窗口、IPC 和本机控制服务；无入参；返回 Promise<void>。 */
async function start() {
  const core = await import("./runtime.js");
  const icon = nativeImage.createFromPath(
    path.join(browserRoot, "assets/icon.png"),
  );
  app.dock?.setIcon(icon);
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 520,
    minHeight: 320,
    title: appName,
    icon,
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hidden",
          trafficLightPosition: { x: 14, y: 16 },
        }
      : {}),
    backgroundColor: "#202126",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: "hotmax-shell",
      v8CacheOptions: "none",
    },
  });
  if (process.platform === "win32") win.setMenu(null);
  controller = createBrowserController(win, core, report);
  const shellFile = path.join(__dirname, "shell.html");
  const shellUrl = pathToFileURL(shellFile).href;
  ipcMain.handle("browser", (event, method, params) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== shellUrl
    )
      throw new Error("仅允许本地浏览器外壳调用 IPC");
    return controller.dispatch(method, params);
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.on("resize", controller.layout);
  win.on("close", (event) => {
    if (!flushed) {
      event.preventDefault();
      app.quit();
    }
  });
  await win.loadFile(shellFile);
  server = await core.serve("browser", controller.dispatch);
  controller
    .dispatch("open", {
      url: process.env.HOTMAX_BROWSER_HOME || homeUrl,
    })
    .catch((error) => report("startup-navigation", error.message));
}

app.on("before-quit", (event) => {
  if (flushed || !controller) return;
  event.preventDefault();
  if (exiting) return;
  exiting = true;
  controller
    .dispose()
    .catch((error) => report("shutdown", error.message))
    .finally(() => {
      server?.close();
      flushed = true;
      app.quit();
    });
});
app.on("window-all-closed", () => app.quit());
app.on("second-instance", () => {
  if (win) {
    win.show();
    win.focus();
  }
});
app.on("child-process-gone", (_, details) => {
  if (!exiting && !["clean-exit", "killed"].includes(details.reason))
    report("child-process", details.reason);
});
if (!app.requestSingleInstanceLock()) app.quit();
else
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      console.error(error.message);
      app.quit();
    });
