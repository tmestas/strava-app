import strava from "strava-v3";
import dotenv from "dotenv";
dotenv.config();

let tokenCache = {
  access_token: process.env.ACCESS_TOKEN,
  refresh_token: process.env.REFRESH_TOKEN,
  expires_at: parseInt(process.env.TOKEN_EXPIRES_AT || "0"),
};

async function refreshIfNeeded() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenCache.expires_at && nowSec < tokenCache.expires_at - 300) {
    return; // still valid with 5-min buffer
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
  console.log(`Token refreshed, expires at ${new Date(payload.expires_at * 1000).toISOString()}`);
}

export async function getStravaClient() {
  await refreshIfNeeded();
  strava.config({ access_token: tokenCache.access_token });
  return strava;
}
