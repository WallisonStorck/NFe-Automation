// ─── Tema ─────────────────────────────────────────────────
function initTheme() {
  const html = document.documentElement;
  const btn = document.getElementById("themeToggle");

  // Carrega preferência salva ou usa "auto"
  const saved = localStorage.getItem("nfseTheme") || "auto";
  html.setAttribute("data-theme", saved);

  btn?.addEventListener("click", () => {
    const current = html.getAttribute("data-theme");
    // Ciclo: auto → light → dark → auto
    const next =
      current === "auto" ? "light" : current === "light" ? "dark" : "auto";
    html.setAttribute("data-theme", next);
    localStorage.setItem("nfseTheme", next);
  });
}

// ─── Navegação entre seções ──────────────────────────────
function initNav() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".section");
  const content = document.querySelector(".content");

  // Todas as seções sempre visíveis (scroll contínuo)
  sections.forEach((s) => {
    s.style.display = "flex";
  });

  // Clique na aba → scroll suave até a seção
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(item.dataset.target);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Scroll → destaca aba da seção visível
  if (content) {
    content.addEventListener("scroll", () => {
      let current = sections[0].id;

      sections.forEach((s) => {
        if (s.offsetTop - content.offsetTop - 40 <= content.scrollTop) {
          current = s.id;
        }
      });

      navItems.forEach((n) => {
        n.classList.toggle("active", n.dataset.target === current);
      });
    });
  }
}

// ─── Status ──────────────────────────────────────────────
function setStatus(msg, state = "idle") {
  const statusEl = document.getElementById("status");
  const sidebarEl = document.getElementById("sidebarStatus");
  const dots = document.querySelectorAll(".dot");

  if (statusEl) statusEl.innerText = msg;
  if (sidebarEl) sidebarEl.innerText = msg;

  dots.forEach((d) => {
    d.className = "dot " + state;
  });
}

// ─── Log ─────────────────────────────────────────────────
function addLog(msg) {
  const log = document.getElementById("log");
  if (!log) return;

  const line = document.createElement("span");
  const lower = msg.toLowerCase();

  if (lower.includes("[error]") || lower.includes("❌")) {
    line.className = "log-error";
  } else if (lower.includes("[warn]") || lower.includes("⚠️")) {
    line.className = "log-warn";
  } else if (lower.includes("✅") || lower.includes("sucesso")) {
    line.className = "log-ok";
  } else if (lower.includes("[info]")) {
    line.className = "log-info";
  }

  line.textContent = msg + "\n";
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  const log = document.getElementById("log");
  if (log) log.innerHTML = "<span>[sistema] Log limpo.</span>\n";
}

// ─── Upload ───────────────────────────────────────────────
function initUpload() {
  const area = document.getElementById("uploadArea");
  const input = document.getElementById("planilha");
  const execRow = document.getElementById("execRow");
  const hintCompact = document.getElementById("uploadHintCompact");
  const btnChange = document.getElementById("btnChange");

  if (!area || !input) return;

  area.addEventListener("click", () => input.click());

  area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.classList.add("drag-over");
  });

  area.addEventListener("dragleave", () => area.classList.remove("drag-over"));

  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("drag-over");
    if (e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      showFile(e.dataTransfer.files[0].name);
    }
  });

  input.addEventListener("change", () => {
    if (input.files.length) showFile(input.files[0].name);
  });

  // Botão "Trocar" volta para o estado de upload
  btnChange?.addEventListener("click", () => {
    input.value = "";
    area.style.display = "";
    execRow.classList.remove("visible");
  });

  function showFile(name) {
    // Esconde o upload grande, mostra a barra compacta
    area.style.display = "none";
    execRow.classList.add("visible");
    if (hintCompact) hintCompact.textContent = name;
  }
}

// ─── Password toggle ──────────────────────────────────────
function initPasswordToggle() {
  const btn = document.getElementById("togglePw");
  const input = document.getElementById("cfgPass");
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
}

// ─── Config ───────────────────────────────────────────────
function parseIgnorarStatus(value) {
  if (!value) return ["SIM", "ZERADO", "INVALIDO"];
  return value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function saveConfig() {
  const cfg = {
    USERNAME: document.getElementById("cfgUser").value.trim(),
    PASSWORD: document.getElementById("cfgPass").value.trim(),
    IGNORAR_STATUS: document.getElementById("cfgIgnorar").value.trim(),
    DATA_EMISSAO_MANUAL: document.getElementById("cfgData").value.trim() || "",
    MAX_TENTATIVAS_CPF: Number(
      document.getElementById("cfgTentativas").value.trim() || "3",
    ),
  };

  localStorage.setItem("nfseConfig", JSON.stringify(cfg));

  // Feedback visual no botão
  const btn = document.getElementById("saveConfig");
  const original = btn.innerHTML;
  btn.textContent = "✓ Salvo!";
  btn.classList.add("btn-success");
  setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove("btn-success");
  }, 2000);

  addLog("✅ Configurações salvas.");
  addLog("👤 Usuário: " + (cfg.USERNAME || "(vazio)"));
  addLog("🔑 Senha: " + (cfg.PASSWORD ? "••••••••" : "(vazio)"));
  addLog(
    "⏭️ Ignorar: " + (cfg.IGNORAR_STATUS || "SIM, ZERADO, INVALIDO (padrão)"),
  );
  addLog("📅 Data: " + (cfg.DATA_EMISSAO_MANUAL || "portal"));
  addLog("🔄 Tentativas CPF: " + cfg.MAX_TENTATIVAS_CPF);
  addLog("------------------------------------------------");
}

function loadConfig() {
  const cfg = JSON.parse(localStorage.getItem("nfseConfig"));
  if (!cfg) {
    addLog("ℹ️ Configure para iniciar.");
    return;
  }

  document.getElementById("cfgUser").value = cfg.USERNAME || "";
  document.getElementById("cfgPass").value = cfg.PASSWORD || "";
  document.getElementById("cfgIgnorar").value = cfg.IGNORAR_STATUS || "";
  document.getElementById("cfgData").value = cfg.DATA_EMISSAO_MANUAL || "";
  document.getElementById("cfgTentativas").value = cfg.MAX_TENTATIVAS_CPF || 3;

  addLog("ℹ️ Configurações carregadas. Revise e clique em iniciar.");
}

// ─── Start ────────────────────────────────────────────────
async function sendConfigAndSpreadsheet() {
  const cfgSaved = JSON.parse(localStorage.getItem("nfseConfig"));
  const fileInput = document.getElementById("planilha");

  if (!cfgSaved) {
    setStatus("Configure antes de iniciar.", "error");
    addLog("❌ Nenhuma configuração encontrada.");
    return;
  }

  if (!fileInput?.files?.length) {
    setStatus("Selecione a planilha.", "error");
    addLog("❌ Nenhuma planilha selecionada.");
    return;
  }

  const cfgToSend = {
    ...cfgSaved,
    IGNORAR_STATUS: parseIgnorarStatus(cfgSaved.IGNORAR_STATUS),
  };

  const formData = new FormData();
  formData.append("config", JSON.stringify(cfgToSend));
  formData.append("planilha", fileInput.files[0]);

  setStatus("Iniciando...", "running");

  try {
    const res = await fetch("/start", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);

    if (!res.ok) throw new Error(data?.error || "Erro ao iniciar automação.");

    setStatus("Em execução", "running");
  } catch (err) {
    setStatus("Erro ao iniciar.", "error");
    addLog("❌ Falha: " + err.message);
    console.error(err);
  }
}

// ─── Stop ─────────────────────────────────────────────────
async function stopAutomation() {
  setStatus("Parando...", "idle");

  try {
    const res = await fetch("/stop", { method: "POST" });
    const data = await res.json().catch(() => null);

    if (!res.ok) throw new Error(data?.error || "Erro ao parar.");

    setStatus("Parada solicitada.", "idle");
  } catch (err) {
    setStatus("Erro ao parar.", "error");
    addLog("❌ Falha: " + err.message);
    console.error(err);
  }
}

// ─── Init ─────────────────────────────────────────────────
window.onload = () => {
  initTheme();
  initNav();
  initUpload();
  initPasswordToggle();
  loadConfig();

  document.getElementById("saveConfig")?.addEventListener("click", (e) => {
    e.preventDefault();
    saveConfig();
  });

  document.getElementById("startBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    sendConfigAndSpreadsheet();
  });

  document.getElementById("stopBtn")?.addEventListener("click", stopAutomation);

  document.getElementById("clearLog")?.addEventListener("click", clearLog);

  // SSE — logs em tempo real
  try {
    const eventSource = new EventSource("/logs");
    eventSource.onmessage = (event) => addLog(event.data);
    eventSource.onerror = () => console.error("SSE perdido.");
  } catch (err) {
    console.error("SSE não disponível:", err);
  }
};
