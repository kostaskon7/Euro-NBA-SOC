import { fetchJson } from "./http.js";

const BASE = "https://api-live.euroleague.net/v2/competitions/E";
const MAX_ROUND = 50;

// The API lists every season with an activationDate; the newest activated one is current.
export async function detectSeason(now = new Date()) {
  const body = await fetchJson(`${BASE}/seasons`);
  const seasons = (body?.data ?? [])
    .filter((s) => s.code && s.activationDate && new Date(s.activationDate) <= now)
    .sort((a, b) => b.year - a.year);
  if (!seasons.length) throw new Error("Could not detect the current EuroLeague season");
  return seasons[0];
}

export async function fetchSeasonGames(seasonCode) {
  const body = await fetchJson(`${BASE}/seasons/${seasonCode}/games`);
  if (!Array.isArray(body?.data)) throw new Error("Unexpected EuroLeague games response");
  return body.data;
}

export function latestPlayedRound(games) {
  let max = 0;
  for (const g of games) {
    const round = Number(g.round?.round ?? g.round);
    if (g.played && Number.isFinite(round) && round > max) max = round;
  }
  return max || null;
}

async function fetchRoundStandings(seasonCode, round) {
  try {
    const body = await fetchJson(`${BASE}/seasons/${seasonCode}/rounds/${round}/standings`);
    const root = Array.isArray(body) ? body[0] : null;
    if (!Array.isArray(root?.standings) || !root.standings.length) return null;
    return { round, root, standings: root.standings };
  } catch {
    return null;
  }
}

// Tries rounds just below the hint first, then falls back to a binary search.
export async function findLatestStandings(seasonCode, hintRound = null) {
  if (hintRound) {
    for (let r = hintRound; r >= Math.max(1, hintRound - 5); r--) {
      const result = await fetchRoundStandings(seasonCode, r);
      if (result) return result;
    }
  }
  let lo = 1;
  let hi = MAX_ROUND;
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const result = await fetchRoundStandings(seasonCode, mid);
    if (result) {
      best = result;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function teamFromClub(club, extra = {}) {
  return {
    code: club.code,
    name: club.name ?? club.code,
    shortName: club.abbreviatedName || club.name || club.code,
    logo: club.images?.crest ?? null,
    rank: null,
    wins: 0,
    losses: 0,
    group: null,
    ...extra
  };
}

export async function getEuroleagueData() {
  const season = await detectSeason();
  const games = await fetchSeasonGames(season.code);

  const playedRound = latestPlayedRound(games);
  let latest = playedRound ? await findLatestStandings(season.code, playedRound) : null;
  let fromPrevious = false;
  if (!latest) {
    latest = await findLatestStandings(`E${season.year - 1}`);
    fromPrevious = Boolean(latest);
  }

  const teams = new Map();
  for (const s of latest?.standings ?? []) {
    const club = s.club ?? {};
    const d = s.data ?? {};
    if (!club.code) continue;
    teams.set(club.code, teamFromClub(club, {
      rank: d.position ?? null,
      wins: d.gamesWon ?? 0,
      losses: d.gamesLost ?? 0
    }));
  }

  const seasonClubs = new Map();
  for (const g of games) {
    for (const side of [g.local, g.road]) {
      if (side?.club?.code) seasonClubs.set(side.club.code, side.club);
    }
  }
  for (const [code, club] of seasonClubs) {
    if (!teams.has(code)) teams.set(code, teamFromClub(club));
  }
  if (fromPrevious) {
    for (const code of [...teams.keys()]) {
      if (!seasonClubs.has(code)) teams.delete(code);
    }
  }

  const cutoff = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const upcoming = games
    .filter((g) => g.played === false && g.local?.club?.code && g.road?.club?.code &&
      typeof g.date === "string" && g.date.slice(0, 10) >= cutoff)
    .map((g) => ({ date: g.date, home: g.local.club.code, away: g.road.club.code }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    league: "euroleague",
    season: season.alias || season.name || season.code,
    seasonCode: season.code,
    standingsRound: latest?.round ?? null,
    standingsFromPreviousSeason: fromPrevious,
    updated: new Date().toISOString(),
    teams: [...teams.values()],
    games: upcoming
  };
}
