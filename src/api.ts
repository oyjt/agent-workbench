export type CreateTaskPayload = {
  title: string;
  prompt: string;
  targetType: "agent" | "agent_team" | "plugin";
  targetId: string;
  owner: string;
  runtime: string;
  priority: "normal" | "high";
  requiresApproval: boolean;
};

export type ApiTask = {
  id: string;
  title: string;
  prompt: string;
  targetType: string;
  targetId: string;
  owner: string;
  runtime: string;
  status: string;
  priority: string;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskResponse = {
  taskId: string;
  runId: string;
  status: string;
  task: ApiTask;
  events: Array<{
    id: string;
    runId: string;
    type: string;
    payload: unknown;
    createdAt: string;
  }>;
};

export async function createApiTask(payload: CreateTaskPayload) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`create_task_failed_${response.status}`);
  }

  return response.json() as Promise<CreateTaskResponse>;
}
