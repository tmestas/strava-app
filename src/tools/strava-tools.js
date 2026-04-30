const METERS_PER_MILE = 1609.34;

function metersToMiles(m) {
  return m / METERS_PER_MILE;
}

function secondsToHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function pacePerMile(distanceMeters, movingTimeSec) {
  const miles = metersToMiles(distanceMeters);
  if (miles === 0) return null;
  const secPerMile = movingTimeSec / miles;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function formatActivity(a) {
  return {
    id: a.id,
    name: a.name,
    date: a.start_date_local?.slice(0, 10),
    type: a.type,
    distance_miles: Math.round(metersToMiles(a.distance) * 10) / 10,
    moving_time: secondsToHMS(a.moving_time),
    pace_per_mile: pacePerMile(a.distance, a.moving_time),
    avg_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    elevation_gain_ft: a.total_elevation_gain
      ? Math.round(a.total_elevation_gain * 3.281)
      : null,
    workout_type: a.workout_type ?? null,
    kudos: a.kudos_count,
  };
}

export async function getRecentActivities(client, limit = 20, type = "Run") {
  const perPage = Math.min(limit, 100);
  const raw = await client.athlete.listActivities({ per_page: perPage, page: 1 });
  const filtered = type === "all" ? raw : raw.filter((a) => a.type === type);
  return {
    count: filtered.length,
    activities: filtered.slice(0, limit).map(formatActivity),
  };
}

export async function getActivityStats(client, weeks = 12) {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const afterEpoch = Math.floor(since.getTime() / 1000);

  const raw = await client.athlete.listActivities({
    after: afterEpoch,
    per_page: 200,
    page: 1,
  });
  const runs = raw.filter((a) => a.type === "Run");

  // Group by week (Monday-based)
  const weekMap = {};
  for (const r of runs) {
    const d = new Date(r.start_date_local);
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday=0
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    const key = monday.toISOString().slice(0, 10);
    if (!weekMap[key]) weekMap[key] = { week_of: key, runs: 0, miles: 0, moving_time_sec: 0 };
    weekMap[key].runs++;
    weekMap[key].miles += metersToMiles(r.distance);
    weekMap[key].moving_time_sec += r.moving_time;
  }

  const weekly = Object.values(weekMap)
    .sort((a, b) => a.week_of.localeCompare(b.week_of))
    .map((w) => ({
      ...w,
      miles: Math.round(w.miles * 10) / 10,
      moving_time: secondsToHMS(w.moving_time_sec),
      moving_time_sec: undefined,
    }));

  const totalMiles = runs.reduce((s, r) => s + metersToMiles(r.distance), 0);
  return {
    period_weeks: weeks,
    total_runs: runs.length,
    total_miles: Math.round(totalMiles * 10) / 10,
    avg_miles_per_week: Math.round((totalMiles / weeks) * 10) / 10,
    weekly_breakdown: weekly,
  };
}

export async function getTrainingLoad(client) {
  // Acute load = last 7 days, Chronic load = last 42 days
  const since42 = Math.floor((Date.now() - 42 * 86400 * 1000) / 1000);
  const raw = await client.athlete.listActivities({ after: since42, per_page: 200 });
  const runs = raw.filter((a) => a.type === "Run");

  const now = Date.now();
  const acute = runs.filter((r) => now - new Date(r.start_date).getTime() < 7 * 86400 * 1000);
  const chronic = runs;

  const sumMiles = (arr) =>
    arr.reduce((s, r) => s + metersToMiles(r.distance), 0);

  const acuteMiles = sumMiles(acute);
  const chronicMiles = sumMiles(chronic);
  const chronicWeeklyAvg = chronicMiles / 6; // 42 days = 6 weeks

  const acuteToChronicRatio =
    chronicWeeklyAvg > 0
      ? Math.round((acuteMiles / chronicWeeklyAvg) * 100) / 100
      : null;

  return {
    acute_load_7d: {
      runs: acute.length,
      miles: Math.round(acuteMiles * 10) / 10,
    },
    chronic_load_42d: {
      runs: chronic.length,
      total_miles: Math.round(chronicMiles * 10) / 10,
      avg_miles_per_week: Math.round(chronicWeeklyAvg * 10) / 10,
    },
    acute_to_chronic_ratio: acuteToChronicRatio,
    interpretation:
      acuteToChronicRatio === null
        ? "Insufficient data"
        : acuteToChronicRatio < 0.8
        ? "Below baseline — undertraining or tapering"
        : acuteToChronicRatio <= 1.3
        ? "Optimal training zone"
        : "High load — injury risk elevated",
  };
}

export async function getBestEfforts(client, months = 6) {
  const since = Math.floor((Date.now() - months * 30 * 86400 * 1000) / 1000);
  const raw = await client.athlete.listActivities({ after: since, per_page: 200 });
  const runs = raw.filter((a) => a.type === "Run");

  const distances = {
    "1_mile": 1609,
    "5K": 5000,
    "10K": 10000,
    "half_marathon": 21097,
  };

  const best = {};
  for (const [label, targetMeters] of Object.entries(distances)) {
    const tolerance = targetMeters * 0.05; // 5% window
    const candidates = runs.filter(
      (r) =>
        Math.abs(r.distance - targetMeters) < tolerance ||
        r.distance >= targetMeters
    );

    if (candidates.length === 0) {
      best[label] = null;
      continue;
    }

    // For races longer than target, estimate split if possible; otherwise use full pace
    const fastest = candidates
      .map((r) => ({
        activity: formatActivity(r),
        effective_pace_sec_per_mile: r.moving_time / metersToMiles(r.distance),
      }))
      .sort((a, b) => a.effective_pace_sec_per_mile - b.effective_pace_sec_per_mile)[0];

    best[label] = {
      pace: pacePerMile(METERS_PER_MILE, fastest.effective_pace_sec_per_mile),
      from_activity: fastest.activity.name,
      date: fastest.activity.date,
    };
  }

  return { period_months: months, best_efforts: best };
}

export async function getLongRuns(client, minMiles = 10, limit = 10) {
  const raw = await client.athlete.listActivities({ per_page: 200, page: 1 });
  const longRuns = raw
    .filter((a) => a.type === "Run" && metersToMiles(a.distance) >= minMiles)
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .slice(0, limit);

  return {
    min_miles: minMiles,
    count: longRuns.length,
    long_runs: longRuns.map(formatActivity),
  };
}
