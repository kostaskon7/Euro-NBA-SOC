// netlify/functions/future_games.js

import { XMLParser } from "fast-xml-parser";

export async function handler(event, context) {
  try {
    const SEASON_CODE = "E2025";
    const scheduleUrl = "https://api-live.euroleague.net/v1/schedules";
    const params = new URLSearchParams({ seasonCode: SEASON_CODE });

    const response = await fetch(`${scheduleUrl}?${params.toString()}`, {
      method: "GET",
      // If the API has HTTPS issues, you might need extra handling,
      // but usually fetch works fine
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Failed to fetch schedule: ${response.statusText}` }),
      };
    }

    const xmlText = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(xmlText);

    // Flatten XML data
    const gamesRaw = data.schedule.item;

    // Map to your previous JSON format
    const futureGames = gamesRaw
      .filter(game => String(game.played).toLowerCase() === "false")
      .map(game => ({
        gamecode: game.gamecode,
        homecode: game.homecode,
        awaycode: game.awaycode,
        date: new Date(game.date).toISOString().split("T")[0], // "YYYY-MM-DD"
        played: false,
      }));

    return {
      statusCode: 200,
      body: JSON.stringify(futureGames),
      headers: {
        "Content-Type": "application/json",
      },
    };

  } catch (err) {
    console.error("Error fetching future games:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
