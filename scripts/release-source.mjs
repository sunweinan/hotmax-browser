import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { root, stage } from "./release-files.mjs";

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hotmax-source-"));
try {
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  await stage(path.join(directory, "hotmax-browser"));
  const dist = path.join(root, "dist");
  await fs.mkdir(dist, { recursive: true });
  const archive = path.join(
    dist,
    `hotmax-browser-${pkg.version}-source.tar.gz`,
  );
  execFileSync("tar", ["-czf", archive, "-C", directory, "hotmax-browser"], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  const hash = createHash("sha256")
    .update(await fs.readFile(archive))
    .digest("hex");
  await fs.writeFile(
    archive + ".sha256",
    `${hash}  ${path.basename(archive)}\n`,
  );
  console.log(archive);
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
