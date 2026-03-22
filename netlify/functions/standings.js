const SEASON_CODE = "E2025";
const MAX_ROUND = 40;
const BASE_URL = "https://api-live.euroleague.net/v2/competitions/E/seasons";

async function fetchRoundStandings(round) {
  const url = `${BASE_URL}/${SEASON_CODE}/rounds/${round}/standings`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return null;

  const data = await res.json();

  // Top level is an array, first element has .standings
  if (!Array.isArray(data) || data.length === 0) return null;

  const root = data[0];
  const standings = root?.standings;
  if (!Array.isArray(standings) || standings.length === 0) return null;

  return { root, standings };
}

async function detectCurrentRound() {
  let lo = 1, hi = MAX_ROUND, best = 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const result = await fetchRoundStandings(mid);
    if (result) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

export default async function handler() {
  try {
    const round = await detectCurrentRound();
    const result = await fetchRoundStandings(round);

    if (!result) {
      return new Response(JSON.stringify({ error: `No standings data for round ${round}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { root, standings } = result;
    const groupName = root?.group?.name ?? "Regular Season";

    const rows = standings.map(s => {
      const club = s.club;
      const d = s.data;
      const ptsFavour = d.pointsFavour ?? 0;
      const ptsAgainst = d.pointsAgainst ?? 0;

      return {
        group: groupName,
        round: round,
        gameNumber: d.gamesPlayed ?? 0,
        teamName: club.name,
        teamCode: club.code,
        ranking: d.position,
        totalGames: d.gamesPlayed ?? 0,
        wins: d.gamesWon ?? 0,
        losses: d.gamesLost ?? 0,
        pointsFavour: ptsFavour,
        pointsAgainst: ptsAgainst,
        difference: ptsFavour - ptsAgainst
      };
    });

    rows.sort((a, b) => a.ranking - b.ranking);

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}