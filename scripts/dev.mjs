import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const processes = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) if (child.exitCode === null) child.kill();
}

function start(name, args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  processes.push(child);
  child.on("error", (error) => { console.error(`${name}: ${error.message}`); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code || 1); });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

start("API", ["--disable-warning=ExperimentalWarning", resolve(root, "server/index.mjs")]);
start("Vite", [resolve(root, "node_modules/vite/bin/vite.js"), ...process.argv.slice(2)]);
