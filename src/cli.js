import fs from "node:fs/promises";
import { rpc, socketPath } from "./runtime.js";

export const help = `Hotmax Browser — local browser control

Usage: hotmax-browser <method> [JSON | @file.json | -]
       hotmax-browser endpoint

Methods:
  tabs open activate close navigate back forward reload
  evaluate request network response screenshot flush quit

Examples:
  hotmax-browser tabs
  hotmax-browser open
  hotmax-browser evaluate "@examples/read-page.json"

JSON results go to stdout; errors go to stderr. Start the app with npm start.
HOTMAX_BROWSER_DATA_DIR selects an isolated browser instance.
`;

/** 读取标准输入中的 JSON 文本；无入参；返回 Promise<string>。 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** 解析命令与参数；输入 string[]；返回 Promise<{method:string,params:object}>。 */
export async function parseCommand(args) {
  const [method, input] = args;
  if (!method || args.length > 2)
    throw new Error("用法：hotmax-browser <method> [JSON | @file | -]");
  const text =
    input === "-"
      ? await readStdin()
      : input?.startsWith("@")
        ? await fs.readFile(input.slice(1), "utf8")
        : input || "{}";
  const params = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!params || Array.isArray(params) || typeof params !== "object")
    throw new Error("参数必须是 JSON 对象");
  return { method, params };
}

/** 执行 CLI 命令并返回可打印结果；输入 string[]；返回 Promise<unknown>。 */
export async function run(args) {
  if (!args.length || ["--help", "-h"].includes(args[0])) return help;
  if (args[0] === "--version")
    return JSON.parse(
      await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
    ).version;
  if (args[0] === "endpoint") return socketPath("browser");
  const { method, params } = await parseCommand(args);
  try {
    return await rpc("browser", method, params);
  } catch (error) {
    if (["ENOENT", "ECONNREFUSED"].includes(error.code))
      error.message =
        "无法连接浏览器，请先启动应用，并确认双方使用相同的数据目录";
    throw error;
  }
}
