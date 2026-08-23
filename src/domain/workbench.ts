export type WorkflowStepRecord = {
  id: string;
  role: string;
  task: string;
  output?: string;
  dependsOn: string[];
  type?: "normal" | "approval" | "human_input";
};

export type WorkflowPlan = {
  key: string;
  name: string;
  description: string;
  provider: string;
  concurrency: number;
  tags: string[];
  steps: WorkflowStepRecord[];
};
