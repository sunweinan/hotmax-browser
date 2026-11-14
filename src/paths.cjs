const path = require("node:path");
const os = require("node:os");
// 浏览器与 CLI 共用用户空间，路径不依赖源码位置或业务项目。
const ROOT = path.resolve(
  process.env.HOTMAX_BROWSER_DATA_DIR ||
    path.join(os.homedir(), ".hotmax-browser"),
);
const DATA = ROOT;
const TEMP = path.join(ROOT, "artifacts");

module.exports = { ROOT, DATA, TEMP };
