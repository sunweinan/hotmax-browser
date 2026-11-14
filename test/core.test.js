import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { NetworkMonitor, redactUrl } from "../src/network.cjs";
import { profileId, allowedPermission } from "../src/profiles.cjs";
import { parseCommand } from "../src/cli.js";

test("profile 标识不允许越界，允许中英文账户名", () => {
  for (const input of ["../escape", "a/b", ".", "", "a\\b", "a".repeat(81)])
    assert.throws(() => profileId(input));
  assert.equal(profileId(), "default");
  assert.equal(profileId("工作-1"), "工作-1");
  if (process.platform === "win32")
    for (const id of ["CON", "nul", "Com1", "LPT²"])
      assert.throws(() => profileId(id), /Windows/);
});

test("网站权限按完整 origin 显式授予", () => {
  const permissions = { "https://example.com": ["media"] };
  assert.equal(
    allowedPermission("https://example.com/path", "media", permissions),
    true,
  );
  assert.equal(
    allowedPermission(
      "https://example.com.attacker.test",
      "media",
      permissions,
    ),
    false,
  );
  assert.equal(
    allowedPermission("https://example.com", "geolocation", permissions),
    false,
  );
  assert.equal(allowedPermission("about:blank", "media", permissions), false);
});

test("网络元信息不包含请求正文、请求头和查询值", () => {
  const debuggerMock = new EventEmitter();
  debuggerMock.attach = () => {};
  debuggerMock.sendCommand = async () => {};
  const monitor = new NetworkMonitor();
  const dispose = monitor.attach({ debugger: debuggerMock }, "1");
  const secret = "synthetic-secret";
  debuggerMock.emit("message", null, "Network.requestWillBeSent", {
    requestId: "a",
    request: {
      url: `https://user:password@example.com/login?token=${secret}#private`,
      method: "POST",
      headers: { Authorization: secret },
      postData: secret,
    },
  });
  assert.equal(JSON.stringify(monitor.records).includes(secret), false);
  assert.equal(monitor.records[0].url.includes("password"), false);
  assert.equal(monitor.records[0].url.includes("#private"), false);
  assert.equal(redactUrl("data:text/html,private"), "data:");
  debuggerMock.emit("message", null, "Network.responseReceived", {
    requestId: "a",
    response: { status: 200, mimeType: "text/html" },
  });
  assert.equal(monitor.records[0].status, 200);
  for (let i = 0; i < 510; i++)
    debuggerMock.emit("message", null, "Network.requestWillBeSent", {
      requestId: String(i),
      request: { url: "https://example.com", method: "GET" },
    });
  assert.equal(monitor.records.length, 500);
  dispose();
  assert.equal(debuggerMock.listenerCount("message"), 0);
});

test("CLI 解析 JSON 参数并拒绝非对象", async () => {
  assert.deepEqual(await parseCommand(["tabs"]), {
    method: "tabs",
    params: {},
  });
  assert.deepEqual(
    await parseCommand(["evaluate", '{"code":"document.title"}']),
    { method: "evaluate", params: { code: "document.title" } },
  );
  assert.deepEqual(await parseCommand(["open", '\uFEFF{"profileId":"工作"}']), {
    method: "open",
    params: { profileId: "工作" },
  });
  await assert.rejects(parseCommand(["open", "[]"]));
  await assert.rejects(parseCommand(["open", "null"]));
  await assert.rejects(parseCommand(["open", "{}", "extra"]));
});
