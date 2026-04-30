import strava from "strava-v3";
import fs from "fs/promises";

export function create_client(accessToken) {
    return new strava.client(accessToken);
}

export async function get_athlete(client) {
    return client.athlete.get({});
}

export async function get_activities(client) {
    return client.athlete.listActivities({});
}

/**
 * Fetches all paginated activities for the authenticated athlete and writes them to a JSON file.
 *
 * @param {object} client - A strava-v3 client instance scoped to the authenticated user.
 * @returns {Promise<void>}
 */
export async function get_and_export_activities(client) {
    const allActivities = [];
    let page = 1;
    const per_page = 200; // max allowed by Strava

    while (true) {
        const activities = await client.athlete.listActivities({ page, per_page });

        if (activities.length === 0) break;

        allActivities.push(...activities);
        console.log(`Fetched page ${page}, total so far: ${allActivities.length}`);
        page++;
    }

    await fs.writeFile("activities.json", JSON.stringify(allActivities, null, 2));
    console.log(`Exported ${allActivities.length} activities to activities.json`);
}


