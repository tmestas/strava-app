import {getAuthCode, exchangeCodeForToken, getActivities} from "./src/auth/strava-auth.js"

const code = await getAuthCode();
console.log("Got auth code, exchanging for token...");

const token = await exchangeCodeForToken(code);
console.log(`Authenticated as: ${token.athlete.firstname} ${token.athlete.lastname}`);
console.log(`Access token expires at: ${new Date(token.expires_at * 1000).toLocaleString()}`);

const activities = await getActivities(token.access_token);
console.log(`Fetched ${activities.length} activities`);
console.log(activities);