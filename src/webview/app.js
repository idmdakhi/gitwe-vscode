const API_BASE = "/api";

// ======== بارگذاری اولیه ========
document.addEventListener("DOMContentLoaded", () => {
  refreshAll();
  loadBranchSelect();
});

async function refreshAll() {
  await Promise.all([
    loadStatus(),
    loadBranches(),
    loadTree(),
    loadDoctor(),
    loadConfig(),
  ]);
}

// ======== وضعیت ========
async function loadStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    const json = await res.json();
    if (json.success) {
      document.getElementById("currentBranch").textContent =
        `📍 ${json.data.currentBranch}`;
      document.getElementById("totalBranches").textContent =
        json.data.totalBranches;
    }
  } catch (e) {
    console.error(e);
  }
}

// ======== شاخه‌ها (برای سلکت commit) ========
async function loadBranchSelect() {
  try {
    const res = await fetch(`${API_BASE}/branches`);
    const json = await res.json();
    if (json.success) {
      const select = document.getElementById("commitBranchSelect");
      select.innerHTML = "";
      json.data.branches.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.name;
        opt.textContent = b.name + (b.isCurrent ? " (current)" : "");
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error(e);
  }
}

// ======== درخت شاخه‌ها ========
async function loadTree() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    const json = await res.json();
    if (json.success) {
      const tree = json.data.tree;
      document.getElementById("tree").innerHTML = renderTree(tree);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderTree(node) {
  if (!node) return "";
  const current = node.isCurrent ? "current" : "";
  let html = `<li><span class="branch-name ${current}" onclick="checkoutBranchName('${node.name}')">${node.name}</span>`;
  if (node.children && node.children.length) {
    html += "<ul>";
    node.children.forEach((child) => {
      html += renderTree(child);
    });
    html += "</ul>";
  }
  html += "</li>";
  return html;
}

// ======== Doctor ========
async function loadDoctor() {
  try {
    const res = await fetch(`${API_BASE}/doctor`);
    const json = await res.json();
    if (json.success) {
      const healthy = json.data.healthy;
      document.getElementById("healthStatus").textContent = healthy
        ? "✅ Healthy"
        : "⚠️ Issues";
      document.getElementById("healthStatus").style.color = healthy
        ? "green"
        : "orange";
    }
  } catch (e) {
    console.error(e);
  }
}

// ======== Config ========
async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const json = await res.json();
    if (json.success) {
      document.getElementById("workflowName").textContent = json.data.name;
    }
  } catch (e) {
    console.error(e);
  }
}

// ======== Actions ========
window.startBranch = async function () {
  const type = document.getElementById("branchType").value.trim();
  const short = document.getElementById("shortName").value.trim();
  if (!type || !short) {
    alert("Fill both fields");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, shortName }),
    });
    const json = await res.json();
    if (json.success) {
      alert(`✅ Started ${json.data.branchName}`);
      refreshAll();
    } else {
      alert(`❌ ${json.message}`);
    }
  } catch (e) {
    alert("Error: " + e.message);
  }
};

window.finishBranch = async function () {
  const branch = document.getElementById("finishBranch").value.trim();
  if (!branch) {
    alert("Enter branch name");
    return;
  }
  const deleteAfter = confirm("Delete branch after finish?");
  try {
    const res = await fetch(`${API_BASE}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchName: branch,
        deleteAfterMerge: deleteAfter,
      }),
    });
    const json = await res.json();
    if (json.success) {
      alert(`✅ Finished ${branch}`);
      refreshAll();
    } else {
      alert(`❌ ${json.message}`);
    }
  } catch (e) {
    alert("Error: " + e.message);
  }
};

window.checkoutBranch = async function () {
  const branch = document.getElementById("checkoutBranch").value.trim();
  if (!branch) {
    alert("Enter branch name");
    return;
  }
  await checkoutBranchName(branch);
};

window.checkoutBranchName = async function (branch) {
  try {
    const res = await fetch(`${API_BASE}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchName: branch }),
    });
    const json = await res.json();
    if (json.success) {
      alert(`✅ Switched to ${branch}`);
      refreshAll();
    } else {
      alert(`❌ ${json.message}`);
    }
  } catch (e) {
    alert("Error: " + e.message);
  }
};

window.showDoctor = async function () {
  const res = await fetch(`${API_BASE}/doctor`);
  const json = await res.json();
  if (json.success) {
    const checks = json.data.checks
      .map(
        (c) =>
          `${c.passed ? "✅" : "❌"} ${c.name}${c.detail ? ": " + c.detail : ""}`,
      )
      .join("\n");
    alert(
      `Doctor Report:\n${checks}\n\nOverall: ${json.data.healthy ? "Healthy" : "Issues found"}`,
    );
  }
};

window.showConfig = async function () {
  const res = await fetch(`${API_BASE}/config`);
  const json = await res.json();
  if (json.success) {
    alert(JSON.stringify(json.data, null, 2));
  }
};

// ======== بارگذاری commitها ========
window.loadCommits = async function () {
  const branch = document.getElementById("commitBranchSelect").value;
  if (!branch) {
    alert("Select a branch");
    return;
  }
  try {
    const res = await fetch(
      `${API_BASE}/commits/${encodeURIComponent(branch)}`,
    );
    const json = await res.json();
    if (json.success) {
      const list = document.getElementById("commitList");
      list.innerHTML = "";
      json.data.forEach((c) => {
        const li = document.createElement("li");
        li.innerHTML =
          `<span class="commit-hash">${c.hash.slice(0, 7)}</span> ` +
          `<span class="commit-message">${c.message}</span> ` +
          `<span class="commit-author">— ${c.author}</span>`;
        list.appendChild(li);
      });
    } else {
      alert("❌ " + json.message);
    }
  } catch (e) {
    alert("Error: " + e.message);
  }
};

// ======== تازه‌سازی خودکار هر ۳۰ ثانیه ========
setInterval(refreshAll, 30000);
