import strava from "strava-v3";

export function create_client(accessToken) {
    return new strava.client(accessToken);
}

export async function get_athlete(client) {
    return client.athlete.get({});
}

export async function get_activities(client) {
    return client.athlete.listActivities({});
}


