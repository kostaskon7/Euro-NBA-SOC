import { getEuroleagueData } from "../lib/euroleague.js";
import { jsonResponse, errorResponse } from "../lib/http.js";

export default async function handler() {
  try {
    return jsonResponse(await getEuroleagueData(), 200, 600);
  } catch (err) {
    return errorResponse(err);
  }
}
