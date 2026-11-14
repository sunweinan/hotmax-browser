#!/usr/bin/env node
import { run } from "../src/cli.js";

try {
  const result = await run(process.argv.slice(2));
  const plain =
    process.argv.length === 2 ||
    ["--help", "-h", "--version", "endpoint"].includes(process.argv[2]);
  console.log(plain ? result : JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    JSON.stringify({
      error: {
        code: error.code || "ERROR",
        message: error.message,
      },
    }),
  );
  process.exitCode = 1;
}
