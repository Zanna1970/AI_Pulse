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
  let particles = [];
  let pulses = [];
  let ripples = [];
  const mouse = { x: -999, y: -999 };

  function buildParticles() {
    // Alta densita: circa 250-300 particelle su desktop
    const targetCount = Math.max(130, Math.min(300, Math.floor((width * height) / 5500)));
    particles = [];
    for (let i = 0; i < targetCount; i++) {
      const depth = 0.55 + Math.random() * 0.85;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45 * depth,
        vy: (Math.random() - 0.5) * 0.45 * depth,
        r: (1.1 + Math.random() * 1.7) * depth,
        depth,
        phase: Math.random() * Math.PI * 2,
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
      r: 4,
      maxR: 250,
      alpha: 0.48,
    });
  });

  function draw() {
    if (width === 0 || height === 0) {
      requestAnimationFrame(draw);
      return;
    }

    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const dotColor = isDark ? "96, 165, 250" : "37, 99, 235";
    const lineColor = isDark ? "56, 189, 248" : "59, 130, 246";
    const pulseColor = isDark ? "52, 211, 153" : "5, 150, 105";
    const maxDist = 125;
    const maxDistSq = maxDist * maxDist;

    // 1. Alone luminoso intorno al cursore
    if (mouse.x > 0 && mouse.y > 0) {
      const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
      grad.addColorStop(0, isDark ? "rgba(59, 130, 246, 0.14)" : "rgba(37, 99, 235, 0.10)");
      grad.addColorStop(0.5, isDark ? "rgba(16, 185, 129, 0.05)" : "rgba(5, 150, 105, 0.04)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 220, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Onde al clic
    for (let k = ripples.length - 1; k >= 0; k--) {
      const rp = ripples[k];
      rp.r += 5.5;
      rp.alpha *= 0.96;

      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${pulseColor}, ${rp.alpha})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - rp.x;
        const dy = p.y - rp.y;
        const d = Math.hypot(dx, dy);
        if (Math.abs(d - rp.r) < 18 && d > 1) {
          p.x += (dx / d) * 1.4;
          p.y += (dy / d) * 1.4;
        }
      }

      if (rp.r >= rp.maxR || rp.alpha < 0.02) {
        ripples.splice(k, 1);
      }
    }

    // 3. Particelle e connessioni
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!reduceMotion) {
        p.phase += 0.025;
        p.x += p.vx;
        p.y += p.vy;

        if (mouse.x > 0) {
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mDistSq = mdx * mdx + mdy * mdy;
          if (mDistSq > 900 && mDistSq < 32400) {
            p.x += mdx * 0.0045;
            p.y += mdy * 0.0045;
          }
        }

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));
      }

      const twinkle = 0.78 + 0.22 * Math.sin(p.phase);
      const baseAlpha = (isDark ? 0.65 : 0.45) * twinkle;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${dotColor}, ${baseAlpha})`;
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDist) * (isDark ? 0.24 : 0.16);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(${lineColor}, ${alpha})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();

          if (!reduceMotion && pulses.length < 32 && Math.random() < 0.0014) {
            pulses.push({
              from: p,
              to: q,
              t: 0,
              speed: 0.022 + Math.random() * 0.025,
            });
          }
        }
      }

      if (mouse.x > 0) {
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const mDistSq = mdx * mdx + mdy * mdy;
        if (mDistSq < 25600) {
          const mDist = Math.sqrt(mDistSq);
          const mAlpha = (1 - mDist / 160) * (isDark ? 0.44 : 0.30);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${pulseColor}, ${mAlpha})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }
    }

    // 4. Impulsi luminosi lungo le connessioni
    for (let m = pulses.length - 1; m >= 0; m--) {
      const pl = pulses[m];
      pl.t += pl.speed;
      if (pl.t >= 1) {
        pulses.splice(m, 1);
        continue;
      }
      const px = pl.from.x + (pl.to.x - pl.from.x) * pl.t;
      const py = pl.from.y + (pl.to.y - pl.from.y) * pl.t;

      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pulseColor}, ${isDark ? 0.92 : 0.78})`;
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
