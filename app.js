"use strict";

const LEAGUES = {
  euroleague: {
    label: "EuroLeague",
    endpoint: "/.netlify/functions/euroleague",
    localLogo: (code) => `photos/team logos/${encodeURIComponent(code)}.webp`,
    defaultGames: 5
  },
  nba: {
    label: "NBA",
    endpoint: "/.netlify/functions/nba",
    localLogo: null,
    defaultGames: 5
  }
};
const DEFAULT_LEAGUE = "euroleague";

const state = {
  league: null,
  games: {},
  sort: "hard",
  query: "",
  cache: {},
  requestId: 0
};

const $ = (sel) => document.querySelector(sel);
const els = {
  tabs: document.querySelectorAll(".tab"),
  title: $("#league-title"),
  meta: $("#league-meta"),
  notice: $("#notice"),
  controls: $("#controls"),
  range: $("#games-range"),
  count: $("#games-count"),
  dec: $("#games-dec"),
  inc: $("#games-inc"),
  sort: $("#sort"),
  search: $("#search"),
  content: $("#content")
};

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style") {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith("--")) el.style.setProperty(prop, v);
        else el.style[prop] = v;
      }
    }
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const winPct = (t) => (t && t.wins + t.losses > 0 ? t.wins / (t.wins + t.losses) : 0.5);
const fmtPct = (v) => (v == null ? "–" : v.toFixed(3).replace(/^0/, ""));
const record = (t) => (t ? `${t.wins}-${t.losses}` : "");
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function safeUrl(url) {
  return typeof url === "string" && /^https:\/\//i.test(url) ? url : null;
}

function initials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function logo(team, code, size = 36) {
  const config = LEAGUES[state.league];
  const sources = [config.localLogo?.(code), safeUrl(team?.logo)].filter(Boolean);
  const fallback = () => h("span", { class: "logo logo-fallback", style: { width: `${size}px`, height: `${size}px` }, "aria-hidden": "true" }, initials(team?.shortName || code));
  if (!sources.length) return fallback();

  let i = 0;
  const img = h("img", {
    class: "logo", src: sources[0], alt: "", width: size, height: size, loading: "lazy", decoding: "async"
  });
  img.addEventListener("error", () => {
    i += 1;
    if (i < sources.length) img.src = sources[i];
    else img.replaceWith(fallback());
  });
  return img;
}

function buildSchedules(data) {
  const schedules = new Map(data.teams.map((t) => [t.code, []]));
  for (const g of data.games) {
    if (!schedules.has(g.home)) schedules.set(g.home, []);
    if (!schedules.has(g.away)) schedules.set(g.away, []);
    schedules.get(g.home).push({ opp: g.away, home: true, date: g.date });
    schedules.get(g.away).push({ opp: g.home, home: false, date: g.date });
  }
  return schedules;
}

function computeRows(data, n) {
  const teamMap = new Map(data.teams.map((t) => [t.code, t]));
  const rows = data.teams.map((team) => {
    const next = (data.schedules.get(team.code) || []).slice(0, n).map((g) => ({ ...g, team: teamMap.get(g.opp) }));
    const sos = next.length ? next.reduce((sum, g) => sum + winPct(g.team), 0) / next.length : null;
    return { team, next, sos, homeGames: next.filter((g) => g.home).length };
  });

  const ranked = rows.filter((r) => r.sos != null).sort((a, b) => b.sos - a.sos);
  ranked.forEach((r, i) => { r.difficulty = i + 1; });
  const values = ranked.map((r) => r.sos);
  return { rows, total: ranked.length, min: Math.min(...values), max: Math.max(...values) };
}

function sortRows(rows) {
  const byNull = (a, b) => (a.sos == null) - (b.sos == null);
  const sorters = {
    hard: (a, b) => byNull(a, b) || b.sos - a.sos,
    easy: (a, b) => byNull(a, b) || a.sos - b.sos,
    standing: (a, b) => (a.team.group || "").localeCompare(b.team.group || "") || (a.team.rank ?? 99) - (b.team.rank ?? 99),
    name: (a, b) => a.team.name.localeCompare(b.team.name)
  };
  return [...rows].sort(sorters[state.sort] || sorters.hard);
}

function heatColor(value, min, max) {
  const t = max > min ? (value - min) / (max - min) : 0.5;
  return `hsl(${Math.round(140 - 140 * t)} 72% 45%)`;
}

function renderRow(row, stats) {
  const { team, next, sos } = row;
  const color = sos == null ? "var(--muted)" : heatColor(sos, stats.min, stats.max);
  const width = sos == null ? 0 : Math.max(4, sos * 100);
  const standing = team.rank != null ? `#${team.rank}${team.group ? ` ${team.group}` : ""}` : "";

  const summary = h("summary", { class: "row-summary" },
    h("span", { class: "diff-rank", style: { "--c": color }, title: "Difficulty rank (1 = hardest)" }, row.difficulty ?? "–"),
    logo(team, team.code, 40),
    h("span", { class: "team" },
      h("span", { class: "team-name" }, team.name),
      h("span", { class: "team-sub" }, [record(team), standing].filter(Boolean).join(" · "))
    ),
    h("span", { class: "preview", "aria-hidden": "true" }, next.slice(0, 6).map((g) => logo(g.team, g.opp, 22))),
    h("span", { class: "sos" },
      h("span", { class: "sos-value", style: { color } }, fmtPct(sos)),
      h("span", { class: "bar" }, h("span", { class: "bar-fill", style: { width: `${width}%`, background: color } }))
    ),
    h("span", { class: "chevron", "aria-hidden": "true" })
  );

  const body = next.length
    ? h("ol", { class: "opponents" }, next.map((g) => {
        const d = new Date(g.date);
        return h("li", { class: "opp" },
          h("span", { class: "opp-date" }, dateFmt.format(d), h("small", {}, timeFmt.format(d))),
          h("span", { class: `ha ${g.home ? "home" : "away"}`, title: g.home ? "Home" : "Away" }, g.home ? "H" : "A"),
          logo(g.team, g.opp, 28),
          h("span", { class: "opp-name" }, g.team?.shortName || g.opp),
          h("span", { class: "opp-rec" }, record(g.team), h("small", {}, fmtPct(winPct(g.team))))
        );
      }))
    : h("p", { class: "empty-small" }, "No upcoming games scheduled.");

  const footer = next.length
    ? h("p", { class: "row-foot" }, `${row.homeGames} home · ${next.length - row.homeGames} away · avg opponent win% ${fmtPct(sos)}`)
    : null;

  return h("details", { class: "row" }, summary, h("div", { class: "row-body" }, body, footer));
}

function renderList() {
  const data = state.cache[state.league]?.data;
  if (!data) return;
  const n = state.games[state.league];
  const stats = computeRows(data, n);
  const q = state.query.trim().toLowerCase();
  const rows = sortRows(stats.rows).filter((r) => !q ||
    r.team.name.toLowerCase().includes(q) || r.team.code.toLowerCase().includes(q));

  els.content.replaceChildren(
    rows.length
      ? h("div", { class: "list", role: "list" }, rows.map((r) => renderRow(r, stats)))
      : h("p", { class: "empty" }, q ? `No teams match “${state.query}”.` : "No upcoming games found for this season yet.")
  );
}

function updateControls() {
  const data = state.cache[state.league]?.data;
  const max = Math.max(1, data?.maxGames || 1);
  const n = Math.min(Math.max(1, state.games[state.league] ?? LEAGUES[state.league].defaultGames), max);
  state.games[state.league] = n;
  els.range.max = String(max);
  els.range.value = String(n);
  els.range.style.setProperty("--fill", `${max > 1 ? ((n - 1) / (max - 1)) * 100 : 100}%`);
  els.count.textContent = String(n);
  els.dec.disabled = n <= 1;
  els.inc.disabled = n >= max;
  els.controls.hidden = !data;
}

function renderHeader() {
  const config = LEAGUES[state.league];
  const data = state.cache[state.league]?.data;
  els.title.textContent = `${config.label} Strength of Schedule`;
  els.meta.textContent = data
    ? [data.season && `Season ${data.season}`, data.standingsRound && `Standings after round ${data.standingsRound}`,
       `Updated ${timeFmt.format(new Date(data.updated))}`].filter(Boolean).join(" · ")
    : "";
  els.notice.hidden = !data?.standingsFromPreviousSeason;
  els.notice.textContent = data?.standingsFromPreviousSeason
    ? "The new season hasn't produced standings yet, so last season's final records are used."
    : "";
  document.title = `${config.label} Strength of Schedule`;
}

function renderSkeleton() {
  els.content.replaceChildren(h("div", { class: "list", "aria-busy": "true", "aria-label": "Loading" },
    Array.from({ length: 8 }, () => h("div", { class: "row skeleton" }))));
}

function renderError(message) {
  els.content.replaceChildren(h("div", { class: "error", role: "alert" },
    h("p", {}, message),
    h("button", { class: "btn", type: "button", onclick: () => loadLeague(state.league, true) }, "Try again")
  ));
}

async function loadLeague(league, force = false) {
  const id = ++state.requestId;
  const cached = state.cache[league];
  if (cached?.data && !force && Date.now() - cached.at < 5 * 60000) {
    renderAll();
    return;
  }

  renderHeader();
  updateControls();
  renderSkeleton();

  try {
    const res = await fetch(LEAGUES[league].endpoint, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !Array.isArray(body.teams) || !Array.isArray(body.games)) {
      throw new Error(body?.error || "Unexpected response from server.");
    }
    body.schedules = buildSchedules(body);
    body.maxGames = Math.max(0, ...[...body.schedules.values()].map((s) => s.length));
    state.cache[league] = { data: body, at: Date.now() };
    if (id === state.requestId) renderAll();
  } catch (err) {
    if (id !== state.requestId) return;
    renderError(err.message || "Could not load data.");
  }
}

function renderAll() {
  renderHeader();
  updateControls();
  renderList();
}

function setLeague(league) {
  if (!LEAGUES[league]) league = DEFAULT_LEAGUE;
  if (state.league === league) return;
  state.league = league;
  state.games[league] ??= LEAGUES[league].defaultGames;
  els.tabs.forEach((tab) => {
    const active = tab.dataset.league === league;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  els.content.setAttribute("aria-labelledby", `tab-${league}`);
  loadLeague(league);
}

function setGames(n) {
  state.games[state.league] = n;
  updateControls();
  renderList();
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (location.hash !== `#${tab.dataset.league}`) location.hash = tab.dataset.league;
    else setLeague(tab.dataset.league);
  });
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const list = [...els.tabs];
    const next = list[(list.indexOf(tab) + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
    next.focus();
    next.click();
  });
});

els.range.addEventListener("input", () => setGames(Number(els.range.value)));
els.dec.addEventListener("click", () => setGames(state.games[state.league] - 1));
els.inc.addEventListener("click", () => setGames(state.games[state.league] + 1));
els.sort.addEventListener("change", () => { state.sort = els.sort.value; renderList(); });
els.search.addEventListener("input", () => { state.query = els.search.value; renderList(); });
window.addEventListener("hashchange", () => setLeague(location.hash.slice(1)));

setLeague(location.hash.slice(1) || DEFAULT_LEAGUE);
