import { renderTabs } from "./shell-view.js";
document.documentElement.dataset.platform = window.browser.platform;
let active;
/** 执行标签命令；输入方法 string、参数 object；返回 Promise<void>，错误显示在工具栏。 */
async function call(method, p = {}) {
  try {
    document.querySelector("#error").textContent = "";
    await window.browser.call(method, { tabId: active, ...p });
  } catch (e) {
    document.querySelector("#error").textContent = e.message;
  }
}
/** 接收主进程快照并更新选中标签；输入 object[]；返回 void。 */
function update(tabs) {
  active = renderTabs(tabs, call);
}
window.browser.onTabs(update);
document.querySelector("#add").onclick = () =>
  call("open", { url: "about:blank" });
document.querySelector("#nav").onsubmit = (e) => {
  e.preventDefault();
  let url = document.querySelector("#url").value.trim();
  if (!url) return;
  if (!/^(https?:|about:)/.test(url)) url = "https://" + url;
  call("navigate", { url });
};
for (const button of document.querySelectorAll("[data-action]"))
  button.onclick = () => call(button.dataset.action);
window.browser
  .call("tabs")
  .then(update)
  .catch((e) => {
    document.querySelector("#error").textContent = e.message;
  });
