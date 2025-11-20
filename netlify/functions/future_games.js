import { parseStringPromise } from "xml2js";

export default async function handler() {
  try {
    const url = "https://api-live.euroleague.net/v1/schedules";
    const params = new URLSearchParams({ seasonCode: "E2025" });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch EuroLeague schedules" }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const xml = await response.text();
    const data = await parseStringPromise(xml);

    const games = data.schedule.item.map(item => ({
      gamecode: item.gamecode?.[0] ?? null,
      homecode: item.homecode?.[0] ?? null,
      awaycode: item.awaycode?.[0] ?? null,
      date: item.date?.[0] ?? null,
      played: String(item.played?.[0]).toLowerCase() === "true"
    }));

    const futureGames = games
      .filter(g => !g.played)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return new Response(JSON.stringify(futureGames), {
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
