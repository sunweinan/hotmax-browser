import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { packager } from "@electron/packager";
import { root, stage, runtimeFiles } from "./release-files.mjs";

if (!["darwin", "win32"].includes(process.platform))
  throw new Error("当前应用构建支持 macOS 和 Windows");
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hotmax-package-"));
try {
  await stage(directory, runtimeFiles);
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  const electron = JSON.parse(
    await fs.readFile(
      path.join(root, "node_modules/electron/package.json"),
      "utf8",
    ),
  );
  const licenses = path.join(root, "node_modules/electron/dist");
  await fs.access(path.join(licenses, "LICENSES.chromium.html"));
  const output = await packager({
    dir: directory,
    out: path.join(root, "dist/apps"),
    name: "Hotmax Browser",
    appBundleId: "chat.hotmax.browser",
    appVersion: pkg.version,
    electronVersion: electron.version,
    platform: process.platform,
    arch: process.arch,
    icon: path.join(
      root,
      process.platform === "darwin"
        ? "assets/icons/app.icns"
        : "assets/icons/app.ico",
    ),
    asar: true,
    overwrite: true,
    prune: false,
    extraResource: [
      path.join(licenses, "LICENSE"),
      path.join(licenses, "LICENSES.chromium.html"),
      path.join(root, "THIRD_PARTY_NOTICES.md"),
    ],
  });
  console.log(output.join("\n"));
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
