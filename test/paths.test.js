import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** 在独立源码目录读取路径配置；输入目录 string、环境 object；返回路径 object。 */
function resolvePaths(directory, extra = {}) {
  const env = { ...process.env };
  delete env.CPS_ROOT;
  delete env.HOTMAX_BROWSER_DATA_DIR;
  const child = spawnSync(
    process.execPath,
    ["-p", "JSON.stringify(require('./src/paths.cjs'))"],
    {
      cwd: directory,
      env: { ...env, ...extra },
      encoding: "utf8",
    },
  );
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test("用户空间与源码、旧项目配置相互独立", () => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "hotmax-paths-")),
  );
  try {
    fs.mkdirSync(path.join(dir, "src"));
    for (const file of ["paths.cjs", "config.cjs"])
      fs.copyFileSync(
        new URL("../src/" + file, import.meta.url),
        path.join(dir, "src", file),
      );
    const standalone = path.join(os.homedir(), ".hotmax-browser");
    assert.deepEqual(resolvePaths(dir), {
      ROOT: standalone,
      DATA: standalone,
      TEMP: path.join(standalone, "artifacts"),
    });
    fs.writeFileSync(
      path.join(dir, "runtime.config.json"),
      JSON.stringify({ workspaceRoot: path.join(dir, "configured") }),
    );
    assert.equal(resolvePaths(dir).ROOT, standalone);
    assert.equal(
      resolvePaths(dir, { CPS_ROOT: path.join(dir, "legacy") }).DATA,
      standalone,
    );
    const isolated = path.join(dir, "isolated");
    assert.deepEqual(
      resolvePaths(dir, {
        CPS_ROOT: path.join(dir, "legacy"),
        HOTMAX_BROWSER_DATA_DIR: isolated,
      }),
      {
        ROOT: isolated,
        DATA: isolated,
        TEMP: path.join(isolated, "artifacts"),
      },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
