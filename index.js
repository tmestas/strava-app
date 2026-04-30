import { getAuthCode, exchangeToken } from "./src/auth/strava-auth.js";
import { create_client, get_athlete, get_activities, get_and_export_activities} from "./src/clients/strava-client.js";

const code = await getAuthCode();        // opens browser, waits for redirect
const token = await exchangeToken(code); // exchanges code via strava.oauth.getToken

const client = create_client(token.access_token);

const activities = await get_and_export_activities(client);

return;