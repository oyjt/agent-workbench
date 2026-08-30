import assert from "node:assert/strict";
import test from "node:test";
import { chatCompletionsUrl, createChatCompletion, ModelRequestError, parseOpenAiStream } from "./openai-compatible.mjs";

test("builds a chat completions endpoint from an OpenAI-compatible base URL", () => {
  assert.equal(chatCompletionsUrl("https://api.example.com/v1"), "https://api.example.com/v1/chat/completions");
  assert.equal(chatCompletionsUrl("http://127.0.0.1:11434/v1/"), "http://127.0.0.1:11434/v1/chat/completions");
  assert.throws(() => chatCompletionsUrl("ftp://example.com/v1"), /invalid_model_base_url/);
});

test("parses streaming chunks across arbitrary byte boundaries", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    "data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\r",
    "\ndata: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}\n",
    "data: [DONE]\n",
  ].map((value) => encoder.encode(value));
  const stream = new ReadableStream({ pull(controller) { const chunk = chunks.shift(); chunk ? controller.enqueue(chunk) : controller.close(); } });
  const payloads = [];
  for await (const payload of parseOpenAiStream(stream)) payloads.push(payload);
  assert.deepEqual(payloads.map((payload) => payload.choices[0].delta.content), ["你", "好"]);
});

test("sends the protocol subset and accumulates streaming text", async () => {
  const encoder = new TextEncoder();
  const deltas = [];
  let request;
  const result = await createChatCompletion({
    baseUrl: "https://api.example.com/v1",
    authType: "bearer",
    apiKey: "secret",
    model: "example-model",
    messages: [{ role: "user", content: "你好" }],
    onDelta: (text) => deltas.push(text),
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\"完成\"}}]}\n\ndata: [DONE]\n\n")); controller.close(); } }), { headers: { "content-type": "text/event-stream", "x-request-id": "req_1" } });
    },
  });
  assert.equal(request.url, "https://api.example.com/v1/chat/completions");
  assert.equal(request.init.headers.authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request.init.body), { model: "example-model", messages: [{ role: "user", content: "你好" }], stream: true });
  assert.deepEqual(deltas, ["完成"]);
  assert.deepEqual(result, { text: "完成", requestId: "req_1" });
});

test("accepts a non-streaming compatible response", async () => {
  const result = await createChatCompletion({
    baseUrl: "http://localhost:11434/v1",
    authType: "none",
    model: "local-model",
    messages: [],
    stream: false,
    fetchImpl: async () => Response.json({ choices: [{ message: { content: "ok" } }] }),
  });
  assert.equal(result.text, "ok");
});

test("exposes bounded provider errors without leaking credentials", async () => {
  await assert.rejects(
    createChatCompletion({
      baseUrl: "https://api.example.com/v1",
      authType: "bearer",
      apiKey: "secret",
      model: "bad-model",
      messages: [],
      fetchImpl: async () => new Response("invalid model", { status: 404, headers: { "x-request-id": "req_failed" } }),
    }),
    (error) => error instanceof ModelRequestError && error.status === 404 && error.detail === "invalid model" && error.requestId === "req_failed" && !error.message.includes("secret"),
  );
});
