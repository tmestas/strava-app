import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:8080/mcp")
  );

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  await client.connect(transport);

  const tools = await client.listTools();
  console.log("TOOLS:", tools);

  const result = await client.callTool("get_recent_activities", {
    limit: 5,
    type: "Run",
  });

  console.log("RESULT:", result);

  await client.close();
}

main().catch(console.error);