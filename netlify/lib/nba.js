import { fetchJson } from "./http.js";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
const DAY = 86400000;
const WINDOW_CHUNKS = [[0, 29], [30, 59]];

const stat = (entry, name) => entry.stats?.find((s) => s.name === name)?.value;
const pct = (t) => (t.wins + t.losses ? t.wins / (t.wins + t.losses) : 0);
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

// ESPN always serves the current season's standings, split by conference.
async function getStandings() {
  const data = await fetchJson(STANDINGS);
  let season = data.season?.displayName ?? null;
  const teams = [];
  for (const conf of data.children ?? []) {
    season = season ?? conf.standings?.seasonDisplayName ?? null;
    const rows = (conf.standings?.entries ?? [])
      .filter((e) => e.team?.abbreviation)
      .map((e) => ({
        id: e.team.id,
        code: e.team.abbreviation,
        name: e.team.displayName,
        shortName: e.team.shortDisplayName || e.team.name,
        logo: e.team.logos?.[0]?.href ?? null,
        wins: stat(e, "wins") ?? 0,
        losses: stat(e, "losses") ?? 0,
        group: conf.abbreviation || conf.name || null
      }));
    rows.sort((a, b) => pct(b) - pct(a) || b.wins - a.wins || a.losses - b.losses);
    rows.forEach((r, i) => { r.rank = i + 1; });
    teams.push(...rows);
  }
  if (!teams.length) throw new Error("Unexpected NBA standings response");
  return { teams, season };
}

function toGame(ev) {
  const comp = ev.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team;
  const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team;
  const state = (comp?.status ?? ev.status)?.type?.state;
  const seasonType = ev.season?.type ?? ev.seasonType?.type;
  if (!home?.abbreviation || !away?.abbreviation || state !== "pre" || seasonType === 1) return null;
  return { id: ev.id, date: ev.date, home: home.abbreviation, away: away.abbreviation };
}

async function fetchUpcomingEvents(teams) {
  const start = new Date(Date.now() - DAY);
  try {
    const chunks = await Promise.all(WINDOW_CHUNKS.map(([from, to]) => {
      const url = `${SITE}/scoreboard?dates=${ymd(new Date(start.getTime() + from * DAY))}-${ymd(new Date(start.getTime() + to * DAY))}&limit=1000`;
      return fetchJson(url, { timeout: 9000 }).then((d) => d.events ?? []);
    }));
    return chunks.flat();
  } catch {
    // Per-team schedules are heavier but serve as a fallback if the scoreboard range query fails.
    const lists = await Promise.all(teams.map((t) =>
      fetchJson(`${SITE}/teams/${t.id}/schedule`, { timeout: 9000 }).then((d) => d.events ?? []).catch(() => [])
    ));
    return lists.flat();
  }
}

export async function getNbaData() {
  const { teams, season } = await getStandings();
  const events = await fetchUpcomingEvents(teams);

  const now = Date.now();
  const seen = new Set();
  const games = [];
  for (const ev of events) {
    const g = toGame(ev);
    if (!g || seen.has(g.id) || new Date(g.date).getTime() < now - 3 * 3600000) continue;
    seen.add(g.id);
    games.push({ date: g.date, home: g.home, away: g.away });
  }
  games.sort((a, b) => a.date.localeCompare(b.date));

  return {
    league: "nba",
    season,
    standingsFromPreviousSeason: false,
    updated: new Date().toISOString(),
    teams: teams.map(({ id, ...t }) => t),
    games
  };
}
