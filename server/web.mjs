import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const port = option("--port") ?? process.env.AGENT_WORKBENCH_API_PORT ?? "8787";
const host = option("--host") ?? process.env.AGENT_WORKBENCH_API_HOST ?? "127.0.0.1";
const noOpen = args.includes("--no-open");
const dist = resolve(process.cwd(), "dist", "index.html");

if (!existsSync(dist)) {
  console.error("Web build not found. Run `pnpm build` first.");
  process.exit(1);
}

process.env.AGENT_WORKBENCH_API_PORT = String(port);
process.env.AGENT_WORKBENCH_API_HOST = String(host);
await import("./application.mjs");

const browserHost = host === "0.0.0.0" ? "127.0.0.1" : host;
const url = `http://${browserHost}:${port}`;
console.log(`Agent Workbench Web: ${url}`);
if (!noOpen) setTimeout(() => openBrowser(url), 180);

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function openBrowser(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const commandArgs = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, commandArgs, { detached: true, stdio: "ignore" });
  child.on("error", () => console.warn(`Could not open a browser automatically. Open ${url}`));
  child.unref();
}
