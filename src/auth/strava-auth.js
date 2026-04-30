// strava-auth.js
import http from "http";
import { exec } from "child_process";
import "dotenv/config"

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT = process.env.PORT;
const REDIRECT_URI = `http://localhost:${PORT}/exchange_token`;
const SCOPE = "read,activity:read_all,profile:read_all,read_all";

function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? `start /b "" "${url}"` :
    process.platform === "darwin" ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd);
}

/**
 * Opens the Strava OAuth authorization page in the browser and spins up a
 * temporary local server to capture the redirect. Resolves with the
 * authorization code on success, or rejects if the user denies access.
 *
 * @returns {Promise<string>} The authorization code from Strava's redirect.
 */
export function getAuthCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });

      if (error) {
        res.end("<h2>Authorization denied. You can close this tab.</h2>");
        server.close();
        reject(new Error(`Auth denied: ${error}`));
        return;
      }

      if (code) {
        res.end("<h2>Authorization successful! You can close this tab.</h2>");
        server.close();
        resolve(code);
      }
    });

    server.listen(PORT, () => {
      const authUrl =
        `https://www.strava.com/oauth/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&approval_prompt=force` +
        `&scope=${SCOPE}`;

      console.log("Opening Strava authorization in your browser...");
      openBrowser(authUrl);
    });
  });
}

/**
 * Exchanges a Strava authorization code for an access token.
 *
 * @param {string} code - The authorization code received from Strava's redirect.
 * @returns {Promise<object>} The token response, including access_token, refresh_token, and athlete data.
 * @throws {Error} If the token exchange request fails.
 */
export async function exchangeCodeForToken(code) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

/**
 * Fetches the authenticated athlete's activities from the Strava API.
 *
 * @param {string} accessToken - A valid Strava access token with activity:read_all scope.
 * @returns {Promise<object[]>} An array of activity objects.
 * @throws {Error} If the request fails or the token is invalid/expired.
 */
export async function getActivities(accessToken) {
  const res = await fetch("https://www.strava.com/api/v3/athlete/activities", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Activities fetch failed: ${await res.text()}`);
  return res.json();
}