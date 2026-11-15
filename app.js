const state = {
  articles: [],
  dates: [],
  selectedCategory: "Tutte",
  selectedSource: "Tutte",
  searchQuery: "",
  lang: localStorage.getItem("ai-pulse-lang") || "it",
};

const els = {
  grid: document.getElementById("news-grid"),
  statusBar: document.getElementById("status-bar"),
  lastUpdated: document.getElementById("last-updated"),
  archiveSelect: document.getElementById("archive-select"),
  sourceFilter: document.getElementById("source-filter"),
  searchInput: document.getElementById("search-input"),
  btnYesterday: document.getElementById("btn-yesterday"),
  dateTabs: document.getElementById("date-tabs"),
  categoryPills: document.getElementById("category-pills"),
  themeToggle: document.getElementById("theme-toggle"),
  langToggle: document.getElementById("lang-toggle"),
};

function initAmbientParticles() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let t = 0;
  let particles = [];
  let ripples = [];
  const mouse = { x: -999, y: -999 };

  // Configurazione delle 7 curve d'onda sovrapposte
  const waves = [
    { baseY: 0.16, amp1: 26, amp2: 14, freq1: 0.0032, freq2: 0.0068, speed1: 0.014, speed2: 0.019, phase: 0.0, darkColors: ["rgba(59,130,246,0.45)", "rgba(56,189,248,0.35)"], lightColors: ["rgba(37,99,235,0.28)", "rgba(14,165,233,0.22)"] },
    { baseY: 0.28, amp1: 34, amp2: 18, freq1: 0.0026, freq2: 0.0055, speed1: 0.011, speed2: 0.016, phase: 1.3, darkColors: ["rgba(16,185,129,0.42)", "rgba(59,130,246,0.34)"], lightColors: ["rgba(5,150,105,0.24)", "rgba(37,99,235,0.20)"] },
    { baseY: 0.42, amp1: 40, amp2: 20, freq1: 0.0022, freq2: 0.0049, speed1: 0.009, speed2: 0.014, phase: 2.6, darkColors: ["rgba(139,92,246,0.40)", "rgba(56,189,248,0.34)"], lightColors: ["rgba(124,58,237,0.22)", "rgba(14,165,233,0.20)"] },
    { baseY: 0.55, amp1: 36, amp2: 16, freq1: 0.0029, freq2: 0.0061, speed1: 0.013, speed2: 0.017, phase: 3.9, darkColors: ["rgba(56,189,248,0.44)", "rgba(16,185,129,0.34)"], lightColors: ["rgba(2,132,199,0.25)", "rgba(5,150,105,0.20)"] },
    { baseY: 0.68, amp1: 44, amp2: 22, freq1: 0.0020, freq2: 0.0044, speed1: 0.008, speed2: 0.012, phase: 5.1, darkColors: ["rgba(59,130,246,0.42)", "rgba(139,92,246,0.32)"], lightColors: ["rgba(37,99,235,0.24)", "rgba(124,58,237,0.18)"] },
    { baseY: 0.80, amp1: 32, amp2: 15, freq1: 0.0031, freq2: 0.0063, speed1: 0.012, speed2: 0.018, phase: 0.8, darkColors: ["rgba(16,185,129,0.38)", "rgba(56,189,248,0.30)"], lightColors: ["rgba(5,150,105,0.22)", "rgba(14,165,233,0.18)"] },
    { baseY: 0.91, amp1: 28, amp2: 14, freq1: 0.0025, freq2: 0.0052, speed1: 0.010, speed2: 0.015, phase: 2.1, darkColors: ["rgba(99,102,241,0.38)", "rgba(16,185,129,0.28)"], lightColors: ["rgba(79,70,229,0.22)", "rgba(5,150,105,0.18)"] },
  ];

  function buildParticles() {
    const count = Math.max(90, Math.min(200, Math.floor((width * height) / 9000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        waveIdx: i % waves.length,
        yOffset: (Math.random() - 0.5) * 32,
        speedX: 0.25 + Math.random() * 0.55,
        r: 1.1 + Math.random() * 2.1,
        alpha: 0.35 + Math.random() * 0.55,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
  }

  function getWaveY(x, wave) {
    let y =
      wave.baseY * height +
      Math.sin(x * wave.freq1 + t * wave.speed1 + wave.phase) * wave.amp1 +
      Math.cos(x * wave.freq2 - t * wave.speed2 + wave.phase * 0.7) * wave.amp2;

    // Flessione fluida intorno al cursore
    if (mouse.x > 0 && mouse.y > 0) {
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 210) {
        const pull = 1 - dist / 210;
        y += Math.sin(pull * Math.PI) * (dy >= 0 ? 24 : -24);
      }
    }

    // Vibrazione lungo le onde al clic
    for (let k = 0; k < ripples.length; k++) {
      const rp = ripples[k];
      const dist = Math.hypot(x - rp.x, y - rp.y);
      const diff = Math.abs(dist - rp.r);
      if (diff < 60) {
        const force = (1 - diff / 60) * rp.alpha;
        y += Math.sin((dist - rp.r) * 0.12) * 20 * force;
      }
    }

    return y;
  }

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  document.addEventListener("mouseleave", () => {
    mouse.x = -999;
    mouse.y = -999;
  });

  window.addEventListener("click", (e) => {
    if (reduceMotion) return;
    ripples.push({
      x: e.clientX,
      y: e.clientY,
      r: 8,
      maxR: 420,
      alpha: 0.75,
    });
  });

  function draw() {
    if (width === 0 || height === 0) {
      requestAnimationFrame(draw);
      return;
    }

    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";

    if (!reduceMotion) {
      t += 1;
    }

    // Aggiorna eventuali onde da clic
    for (let k = ripples.length - 1; k >= 0; k--) {
      const rp = ripples[k];
      rp.r += 7;
      rp.alpha *= 0.965;

      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = isDark
        ? `rgba(56, 189, 248, ${rp.alpha * 0.35})`
        : `rgba(37, 99, 235, ${rp.alpha * 0.25})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (rp.r >= rp.maxR || rp.alpha < 0.02) {
        ripples.splice(k, 1);
      }
    }

    // 1. Disegna le curve d'onda animate e il riempimento traslucido
    const step = 16;
    for (let w = 0; w < waves.length; w++) {
      const wave = waves[w];
      const colors = isDark ? wave.darkColors : wave.lightColors;

      const strokeGrad = ctx.createLinearGradient(0, 0, width, 0);
      strokeGrad.addColorStop(0, colors[0]);
      strokeGrad.addColorStop(0.5, colors[1]);
      strokeGrad.addColorStop(1, colors[0]);

      ctx.beginPath();
      for (let x = 0; x <= width + step; x += step) {
        const y = getWaveY(x, wave);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = strokeGrad;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Sfumatura morbida sotto ogni curva
      ctx.lineTo(width + step, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(0, wave.baseY * height - 40, 0, wave.baseY * height + 130);
      fillGrad.addColorStop(0, isDark ? "rgba(59, 130, 246, 0.055)" : "rgba(37, 99, 235, 0.035)");
      fillGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    // 2. Disegna le particelle che cavalcano le onde
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!reduceMotion) {
        p.x += p.speedX;
        p.twinklePhase += 0.03;
        if (p.x > width + 10) {
          p.x = -10;
        }
      }

      const wave = waves[p.waveIdx];
      const py = getWaveY(p.x, wave) + p.yOffset;
      const twinkle = 0.65 + 0.35 * Math.sin(p.twinklePhase);
      const a = p.alpha * twinkle * (isDark ? 0.9 : 0.65);

      ctx.beginPath();
      ctx.arc(p.x, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle =
        p.waveIdx % 2 === 0
          ? isDark
            ? `rgba(96, 165, 250, ${a})`
            : `rgba(37, 99, 235, ${a})`
          : isDark
            ? `rgba(52, 211, 153, ${a})`
            : `rgba(5, 150, 105, ${a})`;
      ctx.fill();
    }

    if (!reduceMotion) {
      requestAnimationFrame(draw);
    }
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

function formatItalianDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short", day: "2-digit", month: "long", year: "numeric",
  }).format(dt);
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

async function fetchJson(path) {
  const res = await fetch(`${path}?v=${Date.now()}`);
  if (!res.ok) throw new Error(`Impossibile caricare ${path}`);
  return res.json();
}

function populateSourceFilter(articles) {
  const sources = [...new Set(articles.map((a) => a.source))].sort();
  const prev = state.selectedSource;
  els.sourceFilter.innerHTML = '<option value="Tutte">Tutte le fonti</option>';
  sources.forEach((src) => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    els.sourceFilter.appendChild(opt);
  });
  els.sourceFilter.value = sources.includes(prev) ? prev : "Tutte";
  state.selectedSource = els.sourceFilter.value;
}

function getTranslatedUrl(originalUrl) {
  return `https://translate.google.com/translate?sl=auto&tl=it&u=${encodeURIComponent(originalUrl)}`;
}

function renderArticles() {
  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.articles.filter((art) => {
    if (state.selectedCategory !== "Tutte" && art.category !== state.selectedCategory) return false;
    if (state.selectedSource !== "Tutte" && art.source !== state.selectedSource) return false;
    if (q) {
      const hay = `${art.title} ${art.title_en || ""} ${art.summary} ${art.summary_en || ""} ${art.source}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  els.statusBar.textContent = `Visualizzate ${filtered.length} notizie su ${state.articles.length} disponibili`;
  els.grid.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nessuna notizia trovata con i filtri selezionati.";
    els.grid.appendChild(empty);
    return;
  }

  filtered.forEach((art) => {
    const card = document.createElement("article");
    card.className = "card";

    if (art.image) {
      const img = document.createElement("img");
      img.className = "card-img";
      img.src = art.image;
      img.alt = art.title;
      img.loading = "lazy";
      img.onerror = () => img.remove();
      card.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const badge = document.createElement("span");
    badge.className = "source-badge";
    badge.textContent = art.source;
    const time = document.createElement("time");
    time.textContent = formatItalianDateTime(art.published_at);
    meta.append(badge, time);

    const displayTitle = state.lang === "en" && art.title_en ? art.title_en : art.title;
    const displaySummary = state.lang === "en" && art.summary_en ? art.summary_en : art.summary;
    const itUrl = getTranslatedUrl(art.url);

    const h2 = document.createElement("h2");
    h2.className = "card-title";
    const link = document.createElement("a");
    link.href = state.lang === "en" ? art.url : itUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = displayTitle;
    h2.appendChild(link);

    const summary = document.createElement("p");
    summary.className = "card-summary";
    summary.textContent = displaySummary || "Clicca per leggere l'articolo completo.";

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const readItLink = document.createElement("a");
    readItLink.href = itUrl;
    readItLink.target = "_blank";
    readItLink.rel = "noopener noreferrer";
    readItLink.textContent = "Leggi in Italiano →";

    const readEnLink = document.createElement("a");
    readEnLink.href = art.url;
    readEnLink.target = "_blank";
    readEnLink.rel = "noopener noreferrer";
    readEnLink.textContent = "Originale (EN) ↗";

    actions.append(readItLink, readEnLink);
    body.append(meta, h2, summary, actions);
    card.appendChild(body);
    els.grid.appendChild(card);
  });
}

async function loadLatest() {
  const data = await fetchJson("data/latest.json");
  state.articles = data.articles || [];
  els.lastUpdated.textContent = `Aggiornato: ${formatItalianDateTime(data.updated_at)}`;
  populateSourceFilter(state.articles);
  renderArticles();
}

async function loadArchiveDate(dateStr) {
  const data = await fetchJson(`data/archive/${dateStr}.json`);
  state.articles = data.articles || [];
  populateSourceFilter(state.articles);
  renderArticles();
}

function updateThemeUI(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  els.themeToggle.textContent = theme === "dark" ? "Dark" : "Light";
}

function updateLangUI(lang) {
  if (els.langToggle) {
    els.langToggle.textContent = lang === "en" ? "EN" : "IT";
  }
}

async function init() {
  initAmbientParticles();

  const savedTheme = localStorage.getItem("ai-pulse-theme") || "dark";
  updateThemeUI(savedTheme);
  updateLangUI(state.lang);

  els.themeToggle.addEventListener("click", () => {
    const curr = document.documentElement.getAttribute("data-theme");
    const next = curr === "dark" ? "light" : "dark";
    localStorage.setItem("ai-pulse-theme", next);
    updateThemeUI(next);
  });

  if (els.langToggle) {
    els.langToggle.addEventListener("click", () => {
      state.lang = state.lang === "it" ? "en" : "it";
      localStorage.setItem("ai-pulse-lang", state.lang);
      updateLangUI(state.lang);
      renderArticles();
    });
  }

  try {
    const datesData = await fetchJson("data/dates.json");
    state.dates = datesData.dates || [];

    const yesterdayStr = getYesterdayStr();
    const hasYesterday = state.dates.some((d) => d.date === yesterdayStr);
    if (hasYesterday) {
      els.btnYesterday.disabled = false;
      els.btnYesterday.dataset.date = yesterdayStr;
    } else if (state.dates.length > 1) {
      els.btnYesterday.disabled = false;
      els.btnYesterday.dataset.date = state.dates[1].date;
    }

    state.dates.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.date;
      opt.textContent = `${formatDayLabel(d.date)} (${d.count})`;
      els.archiveSelect.appendChild(opt);
    });
  } catch (e) {
    console.warn("Archivio date non ancora disponibile:", e);
  }

  els.dateTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      els.dateTabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      els.archiveSelect.value = "";
      if (btn.dataset.mode === "latest") {
        await loadLatest();
      } else if (btn.dataset.date) {
        await loadArchiveDate(btn.dataset.date);
      }
    });
  });

  els.archiveSelect.addEventListener("change", async (e) => {
    const dateVal = e.target.value;
    if (!dateVal) return;
    els.dateTabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    await loadArchiveDate(dateVal);
  });

  els.categoryPills.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      els.categoryPills.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.selectedCategory = pill.dataset.category;
      renderArticles();
    });
  });

  els.sourceFilter.addEventListener("change", (e) => {
    state.selectedSource = e.target.value;
    renderArticles();
  });

  els.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderArticles();
  });

  try {
    await loadLatest();
  } catch (err) {
    els.grid.innerHTML = `<div class="empty-state">Nessun dato trovato. Avvia prima la GitHub Action o esegui <code>python scripts/fetch_news.py</code>.</div>`;
  }
}

init();
