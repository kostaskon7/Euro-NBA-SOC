import { parseStringPromise } from "xml2js";

export default async () => {
  try {
    const url = "https://api-live.euroleague.net/v1/schedules";
    const params = new URLSearchParams({ seasonCode: "E2025" });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Failed to fetch EuroLeague schedules" })
      };
    }

    const xml = await response.text();
    const data = await parseStringPromise(xml);

    // Extract games → equivalent to pd.DataFrame(data["schedule"]["item"])
    const games = data.schedule.item.map(item => ({
      gamecode: item.gamecode?.[0] ?? null,
      homecode: item.homecode?.[0] ?? null,
      awaycode: item.awaycode?.[0] ?? null,
      date: item.date?.[0] ?? null,
      played: String(item.played?.[0]).toLowerCase() === "true"
    }));

    // Filter to future/ unplayed games
    let futureGames = games.filter(g => !g.played);

    // Convert date → Date for sorting
    futureGames = futureGames.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(futureGames)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
