import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export function readJson(request) {
  return readBody(request, true);
}

export function readTextOrJson(request) {
  const isJson = String(request.headers["content-type"] ?? "").includes("application/json");
  return readBody(request, isJson);
}

function readBody(request, parseJson) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) request.destroy(new Error("request_too_large"));
    });
    request.on("end", () => {
      if (!parseJson) { resolveBody(body); return; }
      try { resolveBody(body.length > 0 ? JSON.parse(body) : {}); }
      catch { rejectBody(new Error("invalid_json")); }
    });
    request.on("error", rejectBody);
  });
}

const corsHeaders = {
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

export function sendJson(response, status, data) {
  response.writeHead(status, { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}
export function sendText(response, status, body, contentType) {
  response.writeHead(status, { ...corsHeaders, "Content-Type": contentType });
  response.end(body);
}
export function sendEmpty(response, status) {
  response.writeHead(status, corsHeaders);
  response.end();
}

export function createStaticHandler(distDir) {
  return function serveStatic(request, response, pathname) {
    if (!existsSync(distDir) || pathname.startsWith("/api/")) return false;
    const requestedPath = decodeURIComponent(pathname) === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    let filePath = resolve(distDir, requestedPath);
    const relativePath = relative(distDir, filePath);
    if (relativePath.startsWith("..") || relativePath.startsWith("/") || relativePath === "") return false;
    try { if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html"); }
    catch { filePath = join(distDir, "index.html"); }
    if (!existsSync(filePath)) return false;
    response.writeHead(200, {
      "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
      "Content-Type": contentTypeFor(filePath),
    });
    if (request.method !== "HEAD") response.end(readFileSync(filePath));
    else response.end();
    return true;
  };
}

function contentTypeFor(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

