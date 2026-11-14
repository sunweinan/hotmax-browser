import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { createHash } from "node:crypto";
import paths from "./paths.cjs";
export const { ROOT, DATA, TEMP } = paths;
/** 生成本机控制地址；输入服务名 string、可选实例根 string；返回 socket 路径或 Windows 管道名 string。 */
export function socketPath(name, root = ROOT) {
  const identity =
    process.platform === "win32"
      ? path.win32.normalize(root).toLowerCase()
      : root;
  const id = `cps-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}-${name}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${id}`
    : path.join(os.tmpdir(), `${id}.sock`);
}
/** 原子写入 JSON；入参路径 string、值 unknown；返回 void。 */
export function save(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), {
    mode: 0o600,
    flush: true,
  });
  fs.renameSync(tmp, file);
}
/** 读取 JSON；入参路径 string、默认值 unknown；返回解析对象。 */
export function read(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
/** 本地 RPC 客户端；输入服务名/方法 string、参数 object、可选控制地址 string；返回 Promise<unknown>。 */
export function rpc(name, method, params = {}, endpoint = socketPath(name)) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(endpoint);
    let data = "";
    sock.setTimeout(params.file ? 1800000 : 180000, () =>
      sock.destroy(new Error("请求超时")),
    );
    sock.on("connect", () =>
      sock.write(JSON.stringify({ method, params }) + "\n"),
    );
    sock.on("data", (chunk) => {
      data += chunk;
      if (data.includes("\n")) {
        sock.end();
        try {
          const r = JSON.parse(data.split("\n")[0]);
          r.error
            ? reject(Object.assign(new Error(r.error.message), r.error))
            : resolve(r.result);
        } catch (e) {
          reject(e);
        }
      }
    });
    sock.on("end", () => {
      if (!data.includes("\n")) reject(new Error("服务连接已断开"));
    });
    sock.on("error", reject);
  });
}
/** 启动本地 RPC；输入服务名 string、处理器 function、可选控制地址 string；返回 Promise<Server>。 */
export async function serve(name, handler, file = socketPath(name)) {
  const isPipe = process.platform === "win32";
  if (isPipe || fs.existsSync(file)) {
    const live = await new Promise((resolve) => {
      const s = net.connect(file);
      s.on("connect", () => {
        s.end();
        resolve(true);
      });
      s.on("error", () => resolve(false));
    });
    if (live) throw new Error(name + " 已运行");
    if (!isPipe) fs.unlinkSync(file);
  }
  const server = net.createServer((sock) => {
    let data = "";
    let handled = false;
    sock.on("error", () => {});
    sock.on("data", async (chunk) => {
      if (handled) return;
      data += chunk;
      if (Buffer.byteLength(data) > 16 * 1024 * 1024) {
        handled = true;
        sock.end(
          JSON.stringify({
            error: { code: "TOO_LARGE", message: "RPC 请求不能超过 16 MiB" },
          }) + "\n",
        );
        return;
      }
      if (!data.includes("\n")) return;
      handled = true;
      const line = data.split("\n")[0];
      data = "";
      try {
        const { method, params = {} } = JSON.parse(line);
        if (
          typeof method !== "string" ||
          !params ||
          typeof params !== "object" ||
          Array.isArray(params)
        )
          throw new Error("RPC 需要 method 字符串与 params 对象");
        const result = await handler(method, params);
        sock.end(JSON.stringify({ result }) + "\n");
      } catch (e) {
        sock.end(
          JSON.stringify({
            error: { message: e.message, code: e.code || "ERROR" },
          }) + "\n",
        );
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(
      { path: file, readableAll: false, writableAll: false },
      resolve,
    );
  });
  if (!isPipe) {
    fs.chmodSync(file, 0o600);
    server.on("close", () => {
      try {
        fs.unlinkSync(file);
      } catch {}
    });
  }
  return server;
}
/** 创建可重试阻塞错误；输入说明 string；返回 Error。 */
export function blocked(message) {
  return Object.assign(new Error(message), { code: "BLOCKED" });
}
