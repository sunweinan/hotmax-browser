const fs = require("node:fs");
const path = require("node:path");
const { config } = require("./config.cjs");

/** 检查 profile 目录标识；输入 string；返回 string，越界字符或 Windows 设备名抛错。 */
function profileId(value = "default") {
  if (typeof value !== "string" || !/^[\p{L}\p{N}_-]{1,80}$/u.test(value))
    throw new Error(
      "profileId 只能包含字母、数字、下划线和连字符，长度为 1–80",
    );
  if (
    process.platform === "win32" &&
    /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i.test(value)
  )
    throw new Error(
      "profileId 不能使用 Windows 保留设备名，例如 CON、NUL、COM1",
    );
  return value;
}

/** 判断来源是否获准使用网站权限；输入 URL string、权限 string、配置 object；返回 boolean。 */
function allowedPermission(
  url,
  permission,
  permissions = config.permissions || {},
) {
  try {
    return permissions[new URL(url).origin]?.includes(permission) === true;
  } catch {
    return false;
  }
}

/** 管理独立网站会话与 Cookie 快照；输入 runtime object；返回 ProfileStore。 */
class ProfileStore {
  /** 初始化会话缓存与写入队列；输入 runtime object；返回实例。 */
  constructor(core) {
    this.core = core;
    this.sessions = new Map();
    this.pending = new Map();
    this.writes = new Map();
  }

  /** 获取初始化完成的会话；输入 id string；返回 Promise<Session>。 */
  async get(id) {
    id = profileId(id);
    if (!this.pending.has(id)) this.pending.set(id, this.create(id));
    return this.pending.get(id);
  }

  /** 恢复会话 Cookie 并监听变化；输入 id string；返回 Promise<Session>。 */
  async create(id) {
    const { session } = require("electron");
    const directory = path.join(this.core.DATA, "profiles", id);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const ses = session.fromPath(directory, { cache: false });
    await this.clearCache(ses);
    ses.setPermissionCheckHandler((_, permission, origin) =>
      allowedPermission(origin, permission),
    );
    ses.setPermissionRequestHandler((wc, permission, callback, details) =>
      callback(
        allowedPermission(details.requestingUrl || wc.getURL(), permission),
      ),
    );
    for (const cookie of this.core.read(
      path.join(directory, "session-cookies.json"),
      [],
    )) {
      if (cookie.expirationDate && cookie.expirationDate < Date.now() / 1000)
        continue;
      const { hostOnly, session: sessionOnly, ...details } = cookie;
      try {
        await ses.cookies.set({
          ...details,
          url: `${cookie.secure ? "https" : "http"}://${cookie.domain.replace(/^\./, "")}${cookie.path}`,
        });
      } catch {
        // 过期或不再被 Chromium 接受的 Cookie 不阻止会话加载。
      }
    }
    this.sessions.set(id, ses);
    ses.cookies.on("changed", () =>
      this.flush(id).catch((error) => console.error(error.message)),
    );
    return ses;
  }

  /** 串行保存 Cookie 和网站存储；输入 id string；返回 Promise<void>。 */
  flush(id) {
    const write = (this.writes.get(id) || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const ses = this.sessions.get(id);
        if (!ses) return;
        this.core.save(
          path.join(this.core.DATA, "profiles", id, "session-cookies.json"),
          await ses.cookies.get({}),
        );
        await ses.cookies.flushStore();
        ses.flushStorageData();
      });
    this.writes.set(id, write);
    return write;
  }

  /** 保存所有已初始化会话；无入参；返回 Promise<void>。 */
  async flushAll() {
    await Promise.all([...this.pending.values()]);
    await Promise.all([...this.sessions.keys()].map((id) => this.flush(id)));
    await Promise.all(
      [...this.sessions.values()].map((ses) => this.clearCache(ses)),
    );
  }

  /** 清理可重新获取的缓存，保留登录存储；输入 Session；返回 Promise<void>。 */
  async clearCache(ses) {
    await ses.clearCache();
    await ses.clearCodeCaches({});
    await ses.clearSharedDictionaryCache();
    await ses.clearStorageData({
      storages: ["shadercache", "serviceworkers", "cachestorage"],
    });
  }
}

module.exports = { ProfileStore, profileId, allowedPermission };
