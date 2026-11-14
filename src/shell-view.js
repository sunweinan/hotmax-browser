/** 用主进程快照更新标签栏；输入标签数组 object[]、动作回调 function；返回选中标签 string | undefined。 */
export function renderTabs(tabs, onAction) {
  const bar = document.querySelector("#tabs");
  bar.replaceChildren();
  const active = tabs.find((t) => t.active)?.id;
  for (const tab of tabs) {
    const item = document.createElement("div");
    item.className = tab.active ? "tab selected" : "tab";
    item.setAttribute("role", "tab");
    item.setAttribute("aria-selected", String(tab.active));
    item.tabIndex = tab.active ? 0 : -1;
    item.dataset.tabId = tab.id;
    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent =
      tab.url === "about:blank" ? "新标签页" : tab.title || "加载中…";
    item.title = title.textContent;
    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "×";
    close.title = "关闭标签页";
    close.setAttribute("aria-label", `关闭 ${title.textContent}`);
    close.onclick = (e) => {
      e.stopPropagation();
      onAction("close", { tabId: tab.id });
    };
    item.onclick = () => onAction("activate", { tabId: tab.id });
    item.onkeydown = (e) => {
      if (e.target === item && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        onAction("activate", { tabId: tab.id });
      }
    };
    item.append(title, close);
    bar.append(item);
    if (tab.active) {
      if (document.activeElement !== document.querySelector("#url"))
        document.querySelector("#url").value =
          tab.url === "about:blank" ? "" : tab.url;
      document.querySelector("[data-action=back]").disabled = !tab.canGoBack;
      document.querySelector("[data-action=forward]").disabled =
        !tab.canGoForward;
      document.querySelector("#error").textContent = tab.error || "";
    }
  }
  return active;
}
