import { getNbaData } from "../lib/nba.js";
import { jsonResponse, errorResponse } from "../lib/http.js";

export default async function handler() {
  try {
    return jsonResponse(await getNbaData(), 200, 600);
  } catch (err) {
    return errorResponse(err);
  }
}
