import strava from "strava-v3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.resolve(__dirname, "../../.env");
dotenv.config({ path: ENV_PATH });

let tokenCache = {
  access_token: process.env.ACCESS_TOKEN,
  refresh_token: process.env.REFRESH_TOKEN,
  expires_at: parseInt(process.env.TOKEN_EXPIRES_AT || "0"),
};

function persistTokens(tokens) {
  let env = fs.readFileSync(ENV_PATH, "utf8");
  env = env
    .replace(/^ACCESS_TOKEN=.*/m, `ACCESS_TOKEN=${tokens.access_token}`)
    .replace(/^REFRESH_TOKEN=.*/m, `REFRESH_TOKEN=${tokens.refresh_token}`)
    .replace(/^TOKEN_EXPIRES_AT=.*/m, `TOKEN_EXPIRES_AT=${tokens.expires_at}`);
  fs.writeFileSync(ENV_PATH, env, "utf8");
}

async function refreshIfNeeded() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenCache.expires_at && nowSec < tokenCache.expires_at - 300) {
    return;
  }

  console.log("Refreshing Strava token...");
  strava.config({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI || "http://localhost:8080",
  });

  const payload = await strava.oauth.refreshToken(tokenCache.refresh_token);
  tokenCache = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
  };

  persistTokens(tokenCache); // <-- save back to .env

  console.log(`Token refreshed, expires at ${new Date(payload.expires_at * 1000).toISOString()}`);
}

export async function getStravaClient() {
  await refreshIfNeeded();
  strava.config({ access_token: tokenCache.access_token });
  return strava;
}