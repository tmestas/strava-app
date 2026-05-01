import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getStravaClient } from "./clients/strava-client.js";
import {
  getRecentActivities,
  getActivityStats,
  getTrainingLoad,
  getBestEfforts,
  getLongRuns,
} from "./tools/strava-tools.js";

function createMcpServer() {
  const server = new McpServer({
    name: "strava-training",
    version: "1.0.0",
  });

  server.tool(
    "get_recent_activities",
    "Get recent Strava activities with pace, distance, HR, and type. Use this to understand recent training.",
    {
      limit: z.number().min(1).max(100).default(20).describe("Number of activities to return"),
      type: z.enum(["Run", "Ride", "Swim", "Walk", "all"]).default("Run").describe("Activity type filter"),
    },
    async ({ limit, type }) => {
      const client = await getStravaClient();
      const result = await getRecentActivities(client, limit, type);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_activity_stats",
    "Get weekly and monthly mileage summaries to understand training volume trends.",
    {
      weeks: z.number().min(1).max(52).default(12).describe("Number of weeks of history to include"),
    },
    async ({ weeks }) => {
      const client = await getStravaClient();
      const result = await getActivityStats(client, weeks);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_training_load",
    "Get acute (7-day) and chronic (42-day) training load to assess fitness and fatigue.",
    {},
    async () => {
      const client = await getStravaClient();
      const result = await getTrainingLoad(client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_best_efforts",
    "Get the athlete's best pace efforts at key distances (1mi, 5K, 10K, half marathon) from recent runs.",
    {
      months: z.number().min(1).max(24).default(6).describe("How many months back to search for PRs"),
    },
    async ({ months }) => {
      const client = await getStravaClient();
      const result = await getBestEfforts(client, months);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_long_runs",
    "Get all long runs (10+ miles) with pace and HR, useful for marathon readiness assessment.",
    {
      min_miles: z.number().min(6).max(26).default(10).describe("Minimum distance in miles to qualify as a long run"),
      limit: z.number().min(1).max(30).default(10).describe("Max number of long runs to return"),
    },
    async ({ min_miles, limit }) => {
      const client = await getStravaClient();
      const result = await getLongRuns(client, min_miles, limit);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Strava MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
