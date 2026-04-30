import http from "http";
import { exec } from "child_process";
import "dotenv/config";
import strava from "strava-v3";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PORT = 8080;

strava.config({
    access_token: process.env.ACCESS_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    access_token: ACCESS_TOKEN
});


function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? `start /b "" "${url}"` :
    process.platform === "darwin" ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd);
}

export function getAuthURL() {
  console.log(REDIRECT_URI, CLIENT_ID)
    return strava.oauth.getRequestAccessURL({ redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, scope: "read,activity:read_all,profile:read_all,read_all" });
}

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
      const authUrl = getAuthURL(); // use strava library instead of manual URL
      console.log("Opening Strava authorization in your browser...");
      openBrowser(authUrl);
    });
  });
}

export async function exchangeToken(code) {
    return strava.oauth.getToken(code);
}