# Strava MCP Server

An MCP (Model Context Protocol) server that exposes your Strava training data to LLMs like Claude, so you can get real-time coaching advice during marathon training.

## Tools exposed

| Tool | Description |
|------|-------------|
| `get_recent_activities` | Last N runs with pace, distance, HR |
| `get_activity_stats` | Weekly mileage breakdown over N weeks |
| `get_training_load` | Acute/chronic load ratio (injury risk indicator) |
| `get_best_efforts` | Best pace at 1mi, 5K, 10K, half marathon |
| `get_long_runs` | All long runs (10+ mi) with pace and HR |

## Local development

```bash
cp .env.example .env
# Fill in your Strava credentials (see below for how to get TOKEN_EXPIRES_AT)
npm install
npm run dev
```

Test it's working:
```bash
curl http://localhost:3000/health
```

## Getting your Strava tokens + expires_at

Run this once locally (you can reuse your existing strava-app code):
```bash
node -e "
import('./src/clients/strava-client.js').then(async m => {
  const c = await m.getStravaClient();
  console.log('Token valid');
});
"
```

Or get `TOKEN_EXPIRES_AT` from your existing token exchange — Strava returns it as a Unix timestamp in the OAuth response.

## Deploying to AWS

### Option A: EC2 (simplest)

1. Launch an EC2 instance (t3.micro is fine, Amazon Linux 2023)
2. Install Node 22: `curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo yum install -y nodejs`
3. Copy files and install:
   ```bash
   scp -r . ec2-user@<YOUR_IP>:~/strava-mcp
   ssh ec2-user@<YOUR_IP>
   cd strava-mcp && npm install --production
   ```
4. Set env vars in `/etc/environment` or use a `.env` file (never commit it)
5. Run with PM2 for auto-restart:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name strava-mcp
   pm2 save && pm2 startup
   ```
6. Open port 3000 in your EC2 Security Group (inbound TCP 3000 from your IP, or 0.0.0.0/0 if you add auth middleware)

### Option B: ECS Fargate (recommended for production)

1. Build and push the Docker image:
   ```bash
   aws ecr create-repository --repository-name strava-mcp
   docker build -t strava-mcp .
   docker tag strava-mcp:latest <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/strava-mcp:latest
   aws ecr get-login-password | docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com
   docker push <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/strava-mcp:latest
   ```
2. Create an ECS cluster, task definition (512MB/0.25vCPU is plenty), and service
3. Store secrets in **AWS Secrets Manager** — inject them as environment variables in the task definition
4. Attach an Application Load Balancer for a stable HTTPS endpoint

### Option C: AWS Lambda + Function URL (cheapest)

Not recommended for MCP — the streamable-http transport needs persistent connections that Lambda's cold starts and timeout limits work against.

## Connecting Claude to your MCP server

Once deployed, add this to your Claude MCP config (`~/.claude/mcp_config.json` or via Claude Desktop settings):

```json
{
  "mcpServers": {
    "strava": {
      "type": "http",
      "url": "http://<YOUR_EC2_IP>:3000/mcp"
    }
  }
}
```

For production with HTTPS (recommended), put an ALB or nginx in front and use `https://`.

## Security notes

- **Never expose port 3000 to 0.0.0.0/0 without auth.** Add an API key check middleware or restrict the Security Group to your IP only.
- Store Strava secrets in AWS Secrets Manager, not in `.env` files on the server.
- Strava tokens auto-refresh — the server handles this, but the new tokens are only held in memory. A server restart will re-use the original `.env` tokens. If those expire, you'll need to re-run the OAuth flow.

## Adding an API key (simple auth middleware)

Add this to `src/server.js` before the `/mcp` route:

```js
app.use("/mcp", (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (key !== process.env.MCP_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

Then set `MCP_API_KEY` in your environment and add it to your Claude MCP config:
```json
{
  "mcpServers": {
    "strava": {
      "type": "http",
      "url": "https://your-server.com/mcp",
      "headers": { "x-api-key": "your-secret-key" }
    }
  }
}
```
