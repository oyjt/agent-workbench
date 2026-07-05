const navButtons = Array.from(document.querySelectorAll(".menu-item"));
const views = Array.from(document.querySelectorAll(".view"));
const pageTitle = document.querySelector("#page-title");
const pageSubtitle = document.querySelector("#page-subtitle");

const pageMeta = {
  overview: ["工作台", "任务、审批、产物和运行状态集中管理"],
  agents: ["Agents", "管理 Agent、Team、Runtime 与能力范围"],
  plugins: ["插件", "Workflow plugin、输入 schema、pipeline 与授权"],
  knowledge: ["知识库", "团队知识、品牌契约、内容契约和引用治理"],
  connectors: ["连接器", "MCP servers 与受控 CLI commands"],
  creative: ["Creative Studio", "产物预览、来源、引用、版本和导出"],
  workflows: ["工作流", "从模板升级为可复用 plugin pipeline"],
  assets: ["资产", "按项目、平台、版本和来源归档产物"],
  settings: ["设置", "Runtime、Provider、Secret 和安全策略"],
};

function activateView(id) {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === id);
  });
  views.forEach((view) => {
    view.classList.toggle("active", view.id === id);
  });
  const meta = pageMeta[id] || pageMeta.overview;
  pageTitle.textContent = meta[0];
  pageSubtitle.textContent = meta[1];
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

document.querySelectorAll("[data-view-link]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.viewLink));
});

const taskData = {
  media: {
    title: "公众号周更：AI Agent 工作流",
    meta: "内容团队 · BrowserOps + Writer · 38m",
    status: "待审批",
    statusClass: "warning",
  },
  coding: {
    title: "实现 Plugin Capability Gate",
    meta: "开发工程师 · Codex · 12m",
    status: "运行中",
    statusClass: "processing",
  },
  creative: {
    title: "产品上线宣传包",
    meta: "Creative Studio · OpenCode · 已完成",
    status: "已完成",
    statusClass: "success",
  },
  ops: {
    title: "竞品账号内容趋势复盘",
    meta: "运营 Agent · BrowserOps · 需要处理",
    status: "需处理",
    statusClass: "error",
  },
};

const taskRows = Array.from(document.querySelectorAll("[data-task]"));
const runTitle = document.querySelector("#run-title");
const runMeta = document.querySelector("#run-meta");
const runStatus = document.querySelector("#run-status");

taskRows.forEach((row) => {
  row.addEventListener("click", () => {
    taskRows.forEach((item) => item.classList.remove("selected"));
    row.classList.add("selected");
    const data = taskData[row.dataset.task];
    runTitle.textContent = data.title;
    runMeta.textContent = data.meta;
    runStatus.textContent = data.status;
    runStatus.className = `tag ${data.statusClass}`;
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    const filter = button.dataset.filter;
    taskRows.forEach((row) => {
      const visible = filter === "all" || row.dataset.status === filter;
      row.style.display = visible ? "grid" : "none";
    });
  });
});

const drawer = document.querySelector(".drawer");
const drawerBackdrop = document.querySelector(".drawer-backdrop");

function setDrawer(open) {
  drawer.classList.toggle("open", open);
  drawerBackdrop.classList.toggle("open", open);
  drawer.setAttribute("aria-hidden", String(!open));
}

document.querySelectorAll("[data-open-drawer]").forEach((button) => {
  button.addEventListener("click", () => setDrawer(true));
});

document.querySelectorAll("[data-close-drawer]").forEach((button) => {
  button.addEventListener("click", () => setDrawer(false));
});

const modal = document.querySelector(".modal");
const modalBackdrop = document.querySelector(".modal-backdrop");
const toast = document.querySelector(".toast");

function setModal(open) {
  modal.classList.toggle("open", open);
  modalBackdrop.classList.toggle("open", open);
  modal.setAttribute("aria-hidden", String(!open));
}

document.querySelectorAll("[data-open-plugin]").forEach((button) => {
  button.addEventListener("click", () => setModal(true));
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => setModal(false));
});

document.querySelector("[data-grant-plugin]").addEventListener("click", () => {
  setModal(false);
  toast.textContent = "已记录本次授权，插件运行已加入任务队列。";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
});

const artifactPreview = document.querySelector("#artifact-preview");
const artifactTemplates = {
  article: `
    <div class="doc-preview">
      <span class="tag processing">Markdown</span>
      <h3>AI Agent 工作流：从工具到团队协作</h3>
      <p>本文从自媒体、编码、运营三个场景切入，解释为什么通用 Agent 产品不应重写单体 Agent，而应成为任务、工具、知识和产物的工作台。</p>
      <ul>
        <li>引用：公众号发布前审核 SOP</li>
        <li>契约：CONTENT.md v2026-07-04</li>
      </ul>
    </div>
  `,
  landing: `
    <div class="landing-preview">
      <span class="tag processing">HTML</span>
      <h3>Agent Workbench Launch Kit</h3>
      <p>本地优先的多 Agent 控制台，把任务、工具、知识和产物放进一个可审批工作流。</p>
      <div class="landing-panel"><span></span><span></span></div>
    </div>
  `,
  deck: `
    <div class="deck-preview">
      <span class="tag success">PPT</span>
      <div class="slide-card">
        <h3>从 Agent 到 Agent Team</h3>
        <p>10 页产品说明 · 4 个图表 · 2 条决策记录引用</p>
      </div>
    </div>
  `,
  image: `
    <div class="image-preview">
      <div class="cover-block">Agent Workbench</div>
    </div>
  `,
  diff: `
    <div class="diff-preview">
      <pre>+ plugin_grants 表记录授权来源
+ artifact manifest 增加 contractVersions
- 旧资产仅记录本地路径</pre>
    </div>
  `,
};

document.querySelectorAll("[data-artifact]").forEach((button) => {
  button.addEventListener("click", () => {
    button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    artifactPreview.innerHTML = artifactTemplates[button.dataset.artifact];
  });
});

document.querySelectorAll(".switch").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("on");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setDrawer(false);
    setModal(false);
  }
});
