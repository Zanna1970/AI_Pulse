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
};

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
    summary.textContent =
      displaySummary || "Clicca per leggere l'articolo completo.";

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

async function init() {
  const savedTheme = localStorage.getItem("ai-pulse-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  els.themeToggle.addEventListener("click", () => {
    const curr = document.documentElement.getAttribute("data-theme");
    const next = curr === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ai-pulse-theme", next);
  });

  // Pulsante rapido IT / EN nell'header
  const headerActions = document.querySelector(".header-actions");
  if (headerActions) {
    const langBtn = document.createElement("button");
    langBtn.id = "lang-toggle";
    langBtn.className = "btn-icon";
    langBtn.title = "Mostra titoli in Italiano o Inglese";
    const updateLangLabel = () => {
      langBtn.textContent = state.lang === "it" ? "Lingua: IT" : "Lingua: EN";
    };
    updateLangLabel();
    langBtn.addEventListener("click", () => {
      state.lang = state.lang === "it" ? "en" : "it";
      localStorage.setItem("ai-pulse-lang", state.lang);
      updateLangLabel();
      renderArticles();
    });
    headerActions.insertBefore(langBtn, els.themeToggle);
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
