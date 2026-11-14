import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hotmax-rpc-"));
process.env.HOTMAX_BROWSER_DATA_DIR = directory;
const { serve, rpc, socketPath, save, read } =
  await import("../src/runtime.js");

test("RPC、CLI 和文件存储保持同一契约", async () => {
  let count = 0;
  const server = await serve("browser", async (method, params) => {
    count++;
    if (method === "fail") throw new Error("expected failure");
    return { method, params };
  });
  try {
    assert.deepEqual(await rpc("browser", "tabs"), {
      method: "tabs",
      params: {},
    });
    await assert.rejects(rpc("browser", "fail"), /expected failure/);
    await assert.rejects(
      serve("browser", () => {}),
      /已运行/,
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["bin/hotmax-browser.js", "open", '{"url":"https://example.com"}'],
      { env: process.env },
    );
    assert.equal(JSON.parse(stdout).params.url, "https://example.com");
    const before = count;
    await new Promise((resolve, reject) => {
      const socket = net.connect(socketPath("browser"));
      socket.on("connect", () =>
        socket.write('{"method":"tabs"}\n{"method":"tabs"}\n'),
      );
      socket.on("data", () => {});
      socket.on("end", resolve);
      socket.on("error", reject);
    });
    assert.equal(count, before + 1);
    const file = path.join(directory, "settings.json");
    save(file, { value: 1 });
    assert.deepEqual(read(file), { value: 1 });
    save(file, { value: 2 });
    assert.deepEqual(read(file), { value: 2 });
    if (process.platform === "win32") {
      assert(socketPath("browser").startsWith("\\\\.\\pipe\\"));
      assert.equal(
        socketPath("browser", directory.toUpperCase()),
        socketPath("browser"),
      );
    } else {
      assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
      assert.equal((await fs.stat(socketPath("browser"))).mode & 0o777, 0o600);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
