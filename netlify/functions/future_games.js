import { parseStringPromise } from "xml2js";

export default async function handler() {
  const SEASON_CODE = "E2025";
  const url = "https://api-live.euroleague.net/v1/schedules";

  try {
    const res = await fetch(`${url}?seasonCode=${SEASON_CODE}`);
    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Failed to fetch EuroLeague schedules" })
      };
    }

    const xml = await res.text();
    const data = await parseStringPromise(xml);

    // Convert XML items to cleaned array
    let games = data.schedule.item.map(item => ({
      gamecode: item.gamecode?.[0] || null,
      homecode: item.homecode?.[0] || null,
      awaycode: item.awaycode?.[0] || null,
      date: item.date?.[0] || null,
      played: String(item.played?.[0]).toLowerCase() === "true"
    }));

    // Filter to future games
    games = games.filter(g => !g.played);

    // Sort by date
    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(games)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
