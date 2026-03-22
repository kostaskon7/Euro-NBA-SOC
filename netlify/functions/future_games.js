const SEASON_CODE = "E2025";
const BASE_URL = "https://api-live.euroleague.net/v2/competitions/E/seasons";

export default async function handler() {
  try {
    const url = `${BASE_URL}/${SEASON_CODE}/games`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch games: ${res.statusText}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await res.json();
    const games = data?.data;

    if (!Array.isArray(games)) {
      return new Response(JSON.stringify({ error: "Unexpected response structure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const futureGames = games
      .filter(game => game.played === false)
      .map(game => ({
        gamecode: game.gameCode,
        homecode: game.local.club.code,
        awaycode: game.road.club.code,
        date: game.date.split("T")[0],  // "YYYY-MM-DD"
        played: false
      }));

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