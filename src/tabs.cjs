/** 管理标签注册、选择和释放顺序；输入窗口对象、变化回调、布局回调；返回 TabRegistry。 */
class TabRegistry {
  /** 创建标签注册表；输入 BrowserWindow、onChange function、onLayout function；返回实例。 */
  constructor(window, onChange, onLayout) {
    this.window = window;
    this.onChange = onChange;
    this.onLayout = onLayout;
    this.items = new Map();
    this.active = null;
    this.next = 0;
    this.closing = false;
  }
  /** 登记视图；输入 WebContentsView、profileId string；返回标签对象。 */
  add(view, profileId) {
    if (this.closing) throw new Error("浏览器正在退出");
    const t = {
      id: String(++this.next),
      view,
      profileId,
      closing: false,
      error: null,
    };
    this.items.set(t.id, t);
    this.window.contentView.addChildView(view);
    this.active = t.id;
    this.onLayout();
    return t;
  }
  /** 判断标签是否可用；输入标签 object；返回 boolean。 */
  live(t) {
    return !!t && !t.closing && !t.view.webContents.isDestroyed();
  }
  /** 获取可用标签快照；无输入；返回 object[]。 */
  snapshot() {
    return [...this.items.values()]
      .filter((t) => this.live(t))
      .map((t) => {
        const wc = t.view.webContents;
        return {
          id: t.id,
          profileId: t.profileId,
          url: wc.getURL(),
          title: wc.getTitle(),
          active: t.id === this.active,
          canGoBack: wc.navigationHistory.canGoBack(),
          canGoForward: wc.navigationHistory.canGoForward(),
          error: t.error,
        };
      });
  }
  /** 切换标签；输入 ID string；返回 boolean。 */
  activate(id) {
    const t = this.items.get(String(id));
    if (!this.live(t)) throw new Error("标签已关闭");
    this.active = t.id;
    this.onLayout();
    this.onChange();
    return true;
  }
  /** 移除后再释放标签资源；输入 ID string；返回 boolean，重复关闭为 false。 */
  close(id) {
    const t = this.items.get(String(id));
    if (!t) return false;
    const ids = [...this.items.keys()],
      index = ids.indexOf(t.id);
    t.closing = true;
    this.items.delete(t.id);
    if (this.active === t.id)
      this.active = ids[index + 1] || ids[index - 1] || null;
    const wc = t.view.webContents;
    if (t.cleanup) t.cleanup();
    if (!this.window.isDestroyed())
      this.window.contentView.removeChildView(t.view);
    if (!wc.isDestroyed()) {
      if (wc.debugger.isAttached()) wc.debugger.detach();
      wc.close({ waitForBeforeUnload: false });
    }
    if (!this.closing) {
      this.onLayout();
      this.onChange();
    }
    return true;
  }
  /** 退出时释放所有网页；无入参；返回 void。 */
  dispose() {
    if (this.closing) return;
    this.closing = true;
    for (const id of [...this.items.keys()]) this.close(id);
  }
}
module.exports = { TabRegistry };
