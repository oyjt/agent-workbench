export function createApprovalService({ insertApproval, getApproval, updateApprovalStatus, updateTaskAndRunStatus, createId, requiredString, stringOr }) {
  return {
    create(body) {
      const now = new Date().toISOString();
      const approval = {
        id: createId("approval"),
        taskId: requiredString(body.taskId, "taskId"),
        title: requiredString(body.title, "title"),
        source: requiredString(body.source, "source"),
        risk: stringOr(body.risk, "medium"),
        capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
        status: "pending",
        reason: requiredString(body.reason, "reason"),
        createdAt: now,
        updatedAt: now,
      };
      insertApproval.run(approval.id, approval.taskId, approval.title, approval.source, approval.risk, JSON.stringify(approval.capabilities), approval.status, approval.reason, approval.createdAt, approval.updatedAt);
      return approval;
    },
    respond(approvalId, decision) {
      const approval = getApproval.get(approvalId);
      if (!approval) throw new Error("approval_not_found");
      const status = ["allow_once", "allow_session", "allowed"].includes(decision) ? "allowed" : "denied";
      const taskStatus = status === "allowed" ? "running" : "paused";
      updateApprovalStatus.run(status, new Date().toISOString(), approvalId);
      updateTaskAndRunStatus(approval.task_id, taskStatus);
      return { ok: true, status, taskStatus };
    },
  };
}

