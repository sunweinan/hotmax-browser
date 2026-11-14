/** 隐去 URL 中的凭证、查询值和片段；输入 string；返回 string。 */
function redactUrl(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return url.protocol;
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of new Set(url.searchParams.keys()))
      url.searchParams.set(key, "[redacted]");
    return url.href;
  } catch {
    return "";
  }
}

/** 收集有界网络元信息，不保存请求正文；无入参；返回 NetworkMonitor 实例。 */
class NetworkMonitor {
  /** 初始化最近请求列表；无入参；返回实例。 */
  constructor() {
    this.records = [];
  }

  /** 绑定一个标签的调试事件；输入 WebContents、tabId string；返回解绑 function。 */
  attach(wc, tabId) {
    wc.debugger.attach("1.3");
    wc.debugger.sendCommand("Network.enable").catch(() => {});
    const onMessage = (_, method, params) => {
      if (method === "Network.requestWillBeSent") {
        this.records.push({
          id: params.requestId,
          tabId,
          url: redactUrl(params.request.url),
          method: params.request.method,
          at: Date.now(),
        });
      }
      if (method === "Network.responseReceived") {
        const record = this.records.findLast(
          (item) => item.id === params.requestId && item.tabId === tabId,
        );
        if (record)
          Object.assign(record, {
            status: params.response.status,
            mimeType: params.response.mimeType,
          });
      }
      if (this.records.length > 500)
        this.records.splice(0, this.records.length - 500);
    };
    wc.debugger.on("message", onMessage);
    return () => wc.debugger.removeListener("message", onMessage);
  }
}

module.exports = { NetworkMonitor, redactUrl };
