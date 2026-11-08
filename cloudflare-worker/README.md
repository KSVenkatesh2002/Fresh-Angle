# Cloudflare Worker Cron Trigger for Fresh Angle

This Cloudflare Worker serves as the autonomous, external cron heartbeat that dispatches Fresh Angle's GitHub Actions scheduler workflow (`tick.yml`).

By running on Cloudflare's serverless edge, it bypasses GitHub Actions top-of-hour scheduling latency and ensures reliable execution.

---

## 🔒 Security Notice (Public Repository)

**NEVER put tokens, credentials, or secrets in any file in this repository.**  
All sensitive values are configured exclusively via `wrangler secret put` and stored securely inside Cloudflare's encrypted secret store.

---

## 📋 Exact Manual Steps

Follow these steps in your terminal to set up, secure, and deploy the Worker:

### Step 1: Create a Fine-Grained GitHub Personal Access Token (PAT)

1. Open GitHub and navigate to:  
   👉 **Settings** → **Developer Settings** → **Personal Access Tokens** → **Fine-grained tokens**  
   (Direct link: `https://github.com/settings/tokens?type=beta`)
2. Click **Generate new token**.
3. Configure the token details:
   - **Token name**: `fresh-angle-worker-dispatch`
   - **Expiration**: Select your preferred expiration (e.g. 90 days or 1 year)
   - **Repository access**: Select **Only select repositories** → choose **`KSVenkatesh2002/Fresh-Angle`**
4. Set Repository permissions:
   - **Actions**: Select **`Read and write`** *(Required to dispatch the `tick.yml` workflow)*
   - **Metadata**: `Read-only` *(Automatically selected by GitHub)*
   - Leave all other permissions set to *None* or *No access*.
5. Click **Generate token** at the bottom and copy your token (it starts with `github_pat_...`).

---

### Step 2: Create Workers KV Namespace (for 2-Hour Outage Deduplication)

To reliably avoid repeated Telegram alerts across stateless cron invocations during an outage, the worker uses a dedicated Cloudflare Workers KV namespace (`ALERT_KV`).

Run the following command inside `cloudflare-worker/`:
```bash
npx wrangler kv namespace create ALERT_KV
```

**Output Example**:
```text
🌀 Creating namespace with title "fresh-angle-tick-trigger-ALERT_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "ALERT_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

Copy the returned `id` and paste it into [cloudflare-worker/wrangler.jsonc](file:///home/dialedin/project/vercel/Fresh%20Angle/cloudflare-worker/wrangler.jsonc):
```jsonc
  "kv_namespaces": [
    {
      "binding": "ALERT_KV",
      "id": "PASTE_YOUR_KV_NAMESPACE_ID_HERE"
    }
  ]
```

---

### Step 3: Configure Secrets in Cloudflare Worker via Wrangler

Navigate to the worker directory on your terminal:
```bash
cd "/home/dialedin/project/vercel/Fresh Angle/cloudflare-worker"
```

Set the required secrets using `wrangler secret put`. Wrangler will prompt you to enter the secret value securely (nothing is printed to bash history or committed to git):

1. **GitHub Dispatch Token (Required)**:
   ```bash
   npx wrangler secret put GITHUB_DISPATCH_TOKEN
   ```
   *Paste the `github_pat_...` token you created in Step 1 and press Enter.*

2. **Trigger Secret (Required for manual HTTP dispatch)**:
   ```bash
   npx wrangler secret put TRIGGER_SECRET
   ```
   *Enter a secure random secret string (e.g. run `openssl rand -hex 24` to generate one).*

3. **Telegram Bot Token (Optional - for alerting on dispatch failures or >90m outages)**:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```

4. **Telegram Chat ID (Optional - for alerting)**:
   ```bash
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```

---

### Step 4: Deploy the Worker

Deploy the Worker to your Cloudflare account:
```bash
npx wrangler deploy
```

Once deployment completes, Wrangler will display your live worker URL:
```text
Uploaded fresh-angle-tick-trigger (1.20 sec)
Deployed fresh-angle-tick-trigger triggers
  https://fresh-angle-tick-trigger.<your-subdomain>.workers.dev
  Schedule:
    - */15 2-11 * * *
    - 0 0,1,12-23 * * *
```

---

### Step 5: Test and Verify

#### 1. Test Health Check Endpoint
```bash
curl -s "https://fresh-angle-tick-trigger.<your-subdomain>.workers.dev/health"
```
**Expected Response**:
```json
{
  "status": "ok",
  "worker": "fresh-angle-tick-trigger",
  "timestamp": "2026-11-08T12:00:00.000Z",
  "repo": "KSVenkatesh2002/Fresh-Angle",
  "workflow": "tick.yml"
}
```

#### 2. Test Manual Trigger Endpoint
Send an authenticated **HTTP POST** request with the `X-Trigger-Secret` header:
```bash
curl -s -X POST "https://fresh-angle-tick-trigger.<your-subdomain>.workers.dev/trigger" \
  -H "X-Trigger-Secret: <YOUR_TRIGGER_SECRET>"
```
*(Query string tokens are strictly disabled and rejected. Secrets are verified in constant time and never printed to logs).*

**Expected Response**:
```json
{
  "success": true,
  "status": 204,
  "message": "Workflow tick.yml dispatched successfully to GitHub Actions",
  "dispatchedAt": "2026-11-08T12:00:01.000Z"
}
```

#### 3. Confirm in GitHub Actions UI
1. Visit: `https://github.com/KSVenkatesh2002/Fresh-Angle/actions/workflows/tick.yml`
2. You will see a new run titled **"Tick Automation Scheduler"** initiated by **workflow_dispatch**.

---

## ⏰ Cron Trigger Architecture

The Worker runs on **2 cron triggers**, strictly respecting Cloudflare's limit (maximum 3 triggers per worker, keeping account total under 5):

| Trigger | Schedule | Purpose |
| :--- | :--- | :--- |
| `*/15 2-11 * * *` | Every 15 min (02:00–11:45 UTC) | **Active Posting Window**: Dispatches ticks every 15 minutes between 02:30 and 11:30 UTC (08:00 to 17:00 IST). |
| `0 0,1,12-23 * * *` | Hourly at minute 0 | **Off-Peak Window**: Dispatches hourly maintenance and due schedule checks outside posting hours. |

### Watchdog & Retry Safeguards:
- **5xx Network Retry**: If GitHub returns a `5xx` or network failure, the Worker automatically pauses for 3 seconds and retries.
- **Posting Window Disruption Check**: During the 02:30–11:30 UTC posting window, the Worker queries GitHub's Workflow Runs API. If no workflow run has completed in 90+ minutes, it sends a Telegram alert and triggers an immediate dispatch.
- **Durable 2-Hour Outage Deduplication**: Alert timestamps are stored in Workers KV (`ALERT_KV`) with a 2-hour TTL to prevent repeated alert notifications during continuous outages.

---

## 🧪 Testing & Test Slots Note

> [!NOTE]
> **Queue Sharing**: Test slots created via `npm run test-slots -- --count 3 --every 5` (`origin=test`) share the scheduler queue with real production slots in the database. When a test slot is due, the scheduler executes it, but safety rules strictly enforce that:
> 1. It is saved as `status: 'draft'` (never published).
> 2. IndexNow pings and social media shares are bypassed.
> 3. It is labelled with `[TEST]` in admin and Telegram.
> 4. `npm run test-slots -- --cleanup` purges only `origin=test` rows and their Cloudinary assets, leaving real production slots 100% untouched.


