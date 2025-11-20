import { parseStringPromise } from "xml2js";

export default async function handler() {
  const SEASON_CODE = "E2025";
  const url = "https://api-live.euroleague.net/v1/schedules";

  try {
    const res = await fetch(`${url}?seasonCode=${SEASON_CODE}`);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch EuroLeague schedules" }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const xml = await res.text();
    const data = await parseStringPromise(xml);

    let games = data.schedule.item.map(item => ({
      gamecode: item.gamecode?.[0] || null,
      homecode: item.homecode?.[0] || null,
      awaycode: item.awaycode?.[0] || null,
      date: item.date?.[0] || null,
      played: String(item.played?.[0]).toLowerCase() === "true"
    }));

    games = games.filter(g => !g.played);
    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    return new Response(JSON.stringify(games), {
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
