export default async function handler() {
  try {
    const url = "https://api-live.euroleague.net/v1/standings";
    const params = new URLSearchParams({ seasonCode: "E2025" });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch standings" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const xml = await response.text();
    const data = await parseStringPromise(xml);

    const group = data.standings.group;
    const teams = group.team || [];

    const standings = teams.map(t => ({
      group: group["@name"],
      round: group["@round"],
      gameNumber: parseInt(group["@gamenumber"]),
      teamName: t.name?.[0] ?? null,
      teamCode: t.code?.[0] ?? null,
      ranking: parseInt(t.ranking?.[0] ?? 0),
      totalGames: parseInt(t.totalgames?.[0] ?? 0),
      wins: parseInt(t.wins?.[0] ?? 0),
      losses: parseInt(t.losses?.[0] ?? 0),
      pointsFavour: parseInt(t.ptsfavour?.[0] ?? 0),
      pointsAgainst: parseInt(t.ptsagainst?.[0] ?? 0),
      difference: parseInt(t.difference?.[0] ?? 0)
    }));

    return new Response(JSON.stringify(standings), {
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
