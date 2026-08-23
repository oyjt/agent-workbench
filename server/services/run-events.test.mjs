import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRunEventService } from "./run-events.mjs";

test("run event stream replays persisted events and receives publications", () => {
  const request = new EventEmitter();
  const chunks = [];
  const response = { writeHead() {}, write: (chunk) => chunks.push(chunk), end() {} };
  const service = createRunEventService({
    listEvents: { all: () => [{ id: "event_1", run_id: "run_1", type: "run/started", payload: "{}", created_at: "now" }] },
    mapEvent: (row) => ({ id: row.id, runId: row.run_id, type: row.type, payload: {} }),
  });
  service.openStream(request, response, "run_1");
  service.publish({ id: "event_2", runId: "run_1", type: "run/completed", payload: {} });
  request.emit("close");
  assert.match(chunks.join(""), /event_1/);
  assert.match(chunks.join(""), /event_2/);
});

