import { parseStringPromise } from "xml2js";

export default async function handler() {
  const SEASON_CODE = "E2025";
  const url = "https://api-live.euroleague.net/v1/standings";

  try {
    const res = await fetch(`${url}?seasonCode=${SEASON_CODE}`);
    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Failed to fetch EuroLeague standings" })
      };
    }

    const xml = await res.text();
    const data = await parseStringPromise(xml);

    const group = data.standings.group[0];
    const teams = group.team;

    const rows = teams.map(t => ({
      group: group.$.name,
      round: group.$.round,
      gameNumber: parseInt(group.$.gamenumber),
      teamName: t.name[0],
      teamCode: t.code[0],
      ranking: parseInt(t.ranking[0]),
      totalGames: parseInt(t.totalgames[0]),
      wins: parseInt(t.wins[0]),
      losses: parseInt(t.losses[0]),
      pointsFavour: parseInt(t.ptsfavour[0]),
      pointsAgainst: parseInt(t.ptsagainst[0]),
      difference: parseInt(t.difference[0])
    }));

    // Sort by ranking
    rows.sort((a, b) => a.ranking - b.ranking);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
