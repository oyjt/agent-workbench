import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

test("dev starts the API and UI and initializes an empty database", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "workbench-dev-"));
  const apiPort = await freePort();
  const webPort = await freePort();
  const child = spawn(process.execPath, [resolve("scripts/dev.mjs"), "--host", "127.0.0.1", "--port", String(webPort)], {
    cwd: resolve("."),
    env: { ...process.env, AGENT_WORKBENCH_API_PORT: String(apiPort), AGENT_WORKBENCH_DATA_DIR: dataDir },
    stdio: "ignore",
  });
  try {
    let health;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) throw new Error(`dev exited with ${child.exitCode}`);
      try {
        health = await fetch(`http://127.0.0.1:${webPort}/api/health`);
        if (health.ok) break;
      } catch { /* The two servers may still be starting. */ }
      await new Promise((done) => setTimeout(done, 100));
    }
    assert.equal(health?.status, 200);
    assert.match(await (await fetch(`http://127.0.0.1:${webPort}/`)).text(), /<div id="root"><\/div>/);
    assert.ok(existsSync(join(dataDir, "workbench.sqlite")));
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((done) => child.once("exit", done));
    }
    rmSync(dataDir, { recursive: true, force: true });
  }
});
