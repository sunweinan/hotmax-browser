import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const sourceFiles = [
  "src",
  "bin",
  "assets",
  "docs",
  "examples",
  "scripts",
  "test",
  ".github",
  "licenses",
  "README.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "AGENTS.md",
  "package.json",
  "package-lock.json",
  ".gitignore",
  ".gitattributes",
  ".prettierignore",
  "config.example.json",
  "启动浏览器.command",
  "start-windows.cmd",
];
export const runtimeFiles = [
  "src",
  "assets",
  "licenses",
  "package.json",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];

/** 复制指定发布文件，拒绝符号链接；输入源路径 string、目标 string；返回 Promise<void>。 */
async function copy(source, target) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink())
    throw new Error(`发布内容不能包含符号链接：${source}`);
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    for (const entry of await fs.readdir(source)) {
      if (entry === ".DS_Store") continue;
      await copy(path.join(source, entry), path.join(target, entry));
    }
  } else {
    await fs.copyFile(source, target);
    await fs.chmod(target, stat.mode);
  }
}

/** 按白名单生成干净发布目录；输入目标 string、相对路径 string[]；返回 Promise<void>。 */
export async function stage(target, files = sourceFiles) {
  await fs.mkdir(target, { recursive: true });
  for (const file of files)
    await copy(path.join(root, file), path.join(target, file));
}
