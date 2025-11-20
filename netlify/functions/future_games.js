import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

export async function handler() {
  try {
    const SEASON_CODE = "E2025";
    const url = `https://api-live.euroleague.net/v1/schedules?seasonCode=${SEASON_CODE}`;

    const response = await fetch(url);
    if (!response.ok) {
      return { statusCode: 500, body: "Failed to fetch schedule" };
    }

    const xmlText = await response.text();

    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(xmlText);

    const items = data.schedule.item;

    const futureGames = items
      .filter(g => g.played.toLowerCase() !== "true")
      .map(g => ({
        gamecode: g.gamecode,
        homecode: g.homecode,
        awaycode: g.awaycode,
        date: new Date(g.date).toISOString(),
        played: false
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      statusCode: 200,
      body: JSON.stringify(futureGames)
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
