import { parseStringPromise } from "xml2js";

export default async () => {
  try {
    const url = "https://api-live.euroleague.net/v1/standings";
    const params = new URLSearchParams({ seasonCode: "E2025" });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Failed to fetch EuroLeague standings" })
      };
    }

    const xml = await response.text();
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
};
