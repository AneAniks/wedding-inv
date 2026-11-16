import "./sites-env.mjs";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const secretsPath = path.join(root, ".dev.vars");
const args = [
  path.join(root, "node_modules/wrangler/bin/wrangler.js"),
  "dev",
  "--config",
  path.join(root, "dist/server/wrangler.json"),
  "--local",
  "--persist-to",
  path.join(root, ".wrangler/state"),
  "--ip",
  "127.0.0.1",
  "--inspector-port",
  "0",
  ...(existsSync(secretsPath) ? ["--env-file", secretsPath] : []),
  ...process.argv.slice(2),
];
const preview = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
preview.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
preview.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => preview.kill("SIGINT"));
process.on("SIGTERM", () => preview.kill("SIGTERM"));
