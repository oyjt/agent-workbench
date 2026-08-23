# Harness 架构重构

本文记录 Agent Workbench 参考 DeepSeek Harness 后采用的轻量化 harness 架构，以及从当前单体实现迁移的边界。

## 为什么重构

当前产品方向本身是正确的：Workbench 是控制平面，通过 Runtime Adapter 调用 Codex、Claude Code、OpenCode、Browser Worker、MCP、CLI 等执行器，而不是重新实现一个完整模型 Agent。

当前主要问题在实现结构：

- 前端业务、页面、工作流算法和本地存储逻辑集中在 `src/App.tsx`。
- 本地 API、SQLite schema、repository、HTTP/SSE、connector/runtime 执行集中在 `server/index.mjs`。
- Skill、Plugin、Connector、Runtime、Approval 已经是概念模块，但缺少统一运行时注册机制。
- 风险策略和具体执行耦合，后续增加 sandbox、远程 runner、不同权限 profile 会越来越困难。
- 运行事件已经存在，但还没有成为所有执行能力统一的事实源。

## 从 DeepSeek Harness 借鉴什么

不复制其完整 Cordis 和大型 monorepo，而采用下列设计原则：

1. **Everything composable**：运行时能力通过插件注册，不直接修改中心单例。
2. **Capability seam**：接口、provider、consumer 解耦。Runtime、CLI、MCP、Knowledge、Artifact 都可以替换 provider。
3. **Reversible registration**：插件挂载产生的注册必须可以卸载，方便 profile、测试和热重载。
4. **Event-first observability**：执行过程产生统一事件，UI、审计、持久化和回放消费同一事件流。
5. **Policy before execution**：能力发现、权限判断、审批和实际执行是不同阶段。
6. **Scoped capability**：后续 Agent / Team / Workflow step 只看到被允许的 capability 子集。
7. **Profiles over forks**：个人编码、内容运营、自动化等场景通过 profile/loadout 组合能力，而不是复制实现。

## 明确不采用什么

Agent Workbench 不直接复制 DeepSeek Harness 的默认 agent loop、LLM adapter 内核和完整 Cordis 运行时。

原因：

- Workbench 的产品定位是多执行器控制台，成熟 coding agent/worker 应继续由 Runtime Adapter 封装。
- 当前仓库规模较小，引入完整插件框架会显著增加维护成本。
- 首要问题是模块边界和可测试性，而不是重新实现模型工具循环。

## 目标结构

```text
src/
  app/                 React composition root
  features/            页面级功能模块
    tasks/
    agents/
    workflows/
    approvals/
    artifacts/
    knowledge/
    connectors/
  harness/             浏览器/控制平面共享的轻量 harness contracts
    core.ts
    policy.ts
    types.ts
  infrastructure/      API client、local storage、serialization
  shared/              通用 UI、types、utils

server/
  app/                  HTTP composition root
  db/                   schema、migration、connection
  repositories/         SQLite repositories
  harness/              capability registry、policy pipeline
  runtimes/             runtime adapters
  connectors/           CLI / MCP providers
  services/             task/run/approval/artifact services
  transport/            HTTP、SSE
```

## Harness 核心模型

### Plugin

Plugin 只负责向 context 注册能力或监听事件。所有注册返回 disposer，因此卸载 plugin 时可以撤销副作用。

```ts
interface HarnessPlugin {
  id: string;
  setup(ctx: HarnessPluginContext): void | (() => void) | Promise<void | (() => void)>;
}
```

### Capability

Capability 是 Workbench 可以调度或暴露给 Runtime 的最小能力单元。

```ts
interface CapabilityDefinition<Input, Output> {
  id: string;
  title: string;
  risk: "low" | "medium" | "high";
  execute(input: Input, ctx: CapabilityExecutionContext): Promise<Output>;
}
```

第一阶段覆盖：

- `runtime:*`
- `cli:*`
- `mcp:*`
- `knowledge:search`
- `artifact:write`

后续可以补充 schema、timeout、concurrency、presentation metadata。

### Policy pipeline

执行能力之前统一经过：

```text
resolve capability
  -> scope filter
  -> policy decision (allow / ask / deny)
  -> approval when ask
  -> execute provider
  -> normalize result
  -> emit durable run events
```

禁止各 connector 自己散落实现审批判断。

## Event 模型

短期继续复用现有 `events` 表，但逐步统一事件命名：

```text
run/started
run/completed
run/failed
step/started
step/completed
capability/requested
capability/approval-required
capability/started
capability/completed
capability/failed
artifact/created
```

原则：凡是 UI、审计、恢复、回放需要知道的事实都应该进入持久 run event；纯内部生命周期事件可以只在内存 event bus 中传播。

## Runtime Adapter 的位置

现有 Runtime Adapter 方向保留，并提升为 capability provider：

```text
Task Orchestrator
  -> Harness
     -> policy
     -> runtime:codex
     -> runtime:claude-code
     -> runtime:opencode
     -> runtime:browser
```

Workbench 不承担这些 runtime 内部的模型上下文压缩、原生工具循环和模型协议细节。

## Profile / Loadout

Profile 是一组可组合能力和默认策略，例如：

```ts
coding = {
  runtimes: ["codex", "claude-code"],
  skills: ["code-review", "debugging"],
  connectors: ["github", "pnpm"],
  knowledgeScopes: ["project"],
  policy: "coding-default"
}
```

Workflow step、Agent、Team 可以在 profile 基础上继续收窄能力，不能无约束扩大权限。

## 分阶段迁移

### Phase 1 — 建立 seam，不改变功能

- 新增 `src/harness/*` contracts。
- 新增 server harness contracts。
- 增加单元测试基础。
- 保持现有页面和 API 行为兼容。

### Phase 2 — 拆后端单体

优先顺序：

1. db/schema + repositories
2. run event store
3. approval service
4. connector providers
5. runtime adapters
6. HTTP/SSE transport

`server/index.mjs` 最终只做 composition root 和 server startup。

### Phase 3 — 拆前端单体

按 feature 迁移 `App.tsx`：

1. workflows
2. tasks / runs
3. approvals
4. agents / teams
5. connectors / skills
6. knowledge / artifacts

页面组件不直接实现 YAML parser、DAG 算法、API transport 和 local persistence。

### Phase 4 — Capability pipeline

- CLI/MCP 统一注册成 capability。
- 风险等级映射统一 policy。
- `ask` 自动生成 ApprovalRequest。
- approve 后恢复原 capability execution。
- 所有执行结果写统一 run event。

### Phase 5 — Scope/Profile

- Agent profile
- Team profile
- Workflow step capability scope
- project/workspace scope
- provider-specific sandbox

## 完成标准

重构不是以文件数量衡量。完成后应满足：

- `App.tsx` 只承担 app composition，不包含主要领域算法。
- `server/index.mjs` 只承担启动和依赖组装。
- 新增 Runtime/Connector 不需要修改中心 switch/if 链。
- CLI 与 MCP 共用 capability/policy/approval pipeline。
- Run event 可完整驱动运行控制台和审计视图。
- 核心 registry、policy、workflow graph、serialization 有独立测试。
- 静态本地模式仍可以复用同一领域 contracts，而不是复制第二套业务模型。
