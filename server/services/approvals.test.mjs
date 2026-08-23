import assert from "node:assert/strict";
import test from "node:test";
import { createApprovalService } from "./approvals.mjs";

test("approval service persists requests and resumes allowed tasks", () => {
  const inserted = [];
  const updates = [];
  const service = createApprovalService({
    insertApproval: { run: (...args) => inserted.push(args) },
    getApproval: { get: () => ({ task_id: "task_1" }) },
    updateApprovalStatus: { run: (...args) => updates.push(args) },
    updateTaskAndRunStatus: (...args) => updates.push(args),
    createId: () => "approval_1",
    requiredString: (value) => value,
    stringOr: (value, fallback) => value || fallback,
  });
  const approval = service.create({ taskId: "task_1", title: "Publish", source: "connector", reason: "risk" });
  assert.equal(approval.id, "approval_1");
  assert.equal(inserted.length, 1);
  assert.deepEqual(service.respond("approval_1", "allow_once"), { ok: true, status: "allowed", taskStatus: "running" });
  assert.deepEqual(updates.at(-1), ["task_1", "running"]);
});

