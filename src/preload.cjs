const { contextBridge, ipcRenderer } = require("electron");
/** 暴露本地浏览器外壳控制；入参 method string/params object；返回 Promise<unknown>。 */
contextBridge.exposeInMainWorld("browser", {
  platform: process.platform,
  call: (method, params) => ipcRenderer.invoke("browser", method, params),
  onTabs: (callback) => ipcRenderer.on("tabs", (_, tabs) => callback(tabs)),
});
