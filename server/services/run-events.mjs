export function createRunEventService({ listEvents, mapEvent }) {
  const clientsByRun = new Map();

  return {
    publish(event) {
      const clients = clientsByRun.get(event.runId);
      if (!clients) return;
      for (const response of clients) writeEvent(response, "runtime", event);
    },
    openStream(request, response, runId) {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      });
      for (const event of listEvents.all(runId).map(mapEvent)) writeEvent(response, "runtime", event);
      const clients = clientsByRun.get(runId) ?? new Set();
      clients.add(response);
      clientsByRun.set(runId, clients);
      const heartbeat = setInterval(() => writeEvent(response, "ping", { runId, at: new Date().toISOString() }), 15000);
      request.on("close", () => {
        clearInterval(heartbeat);
        clients.delete(response);
        if (clients.size === 0) clientsByRun.delete(runId);
      });
    },
    dispose() {
      for (const clients of clientsByRun.values()) for (const response of clients) response.end();
      clientsByRun.clear();
    },
  };
}

function writeEvent(response, eventName, data) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

