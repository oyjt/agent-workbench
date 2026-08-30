export function chatCompletionsUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("invalid_model_base_url");
  }
  return new URL("chat/completions", `${url.toString().replace(/\/$/, "")}/`).toString();
}

export class ModelRequestError extends Error {
  constructor(code, { status = null, detail = "", requestId = null } = {}) {
    super(code);
    this.name = "ModelRequestError";
    this.status = status;
    this.detail = detail;
    this.requestId = requestId;
  }
}

export async function createChatCompletion({ baseUrl, authType, apiKey, model, messages, stream = true, onDelta, signal, fetchImpl = fetch }) {
  const headers = { "content-type": "application/json" };
  if (authType === "bearer") headers.authorization = `Bearer ${apiKey}`;

  let response;
  try {
    response = await fetchImpl(chatCompletionsUrl(baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, stream }),
      redirect: "error",
      signal,
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new ModelRequestError("model_request_timeout");
    throw new ModelRequestError("model_request_unreachable", { detail: error instanceof Error ? error.message : "network_error" });
  }

  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    throw new ModelRequestError(`model_request_failed_${response.status}`, {
      status: response.status,
      detail: (await response.text()).slice(0, 300),
      requestId,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!stream || contentType.includes("application/json")) {
    const payload = await response.json().catch(() => { throw new ModelRequestError("invalid_model_response", { requestId }); });
    const text = contentText(payload?.choices?.[0]?.message?.content);
    if (!text.trim()) throw new ModelRequestError("model_empty_response", { requestId });
    return { text: text.trim(), requestId };
  }

  if (!response.body) throw new ModelRequestError("model_stream_unavailable", { requestId });
  let text = "";
  for await (const payload of parseOpenAiStream(response.body)) {
    const delta = contentText(payload?.choices?.[0]?.delta?.content);
    if (!delta) continue;
    text += delta;
    onDelta?.(text);
  }
  if (!text.trim()) throw new ModelRequestError("model_empty_response", { requestId });
  return { text: text.trim(), requestId };
}

export async function* parseOpenAiStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const payload = parseDataLine(line);
      if (payload === null) continue;
      if (payload === DONE) return;
      yield payload;
    }
    if (done) break;
  }
  const payload = parseDataLine(buffer);
  if (payload && payload !== DONE) yield payload;
}

const DONE = Symbol("done");

function parseDataLine(line) {
  if (!line.startsWith("data:")) return null;
  const data = line.slice(5).trimStart().trimEnd();
  if (!data) return null;
  if (data === "[DONE]") return DONE;
  try { return JSON.parse(data); }
  catch { throw new ModelRequestError("invalid_model_stream"); }
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "").join("");
}
