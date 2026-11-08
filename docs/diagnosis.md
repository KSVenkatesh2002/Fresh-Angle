# Diagnosis Report: Scheduling, Timezone, and Slot Execution System

**Date:** 2026-11-07  
**Engine:** Fresh Angle Autonomous Publishing System  
**Methodology:** Evidence-based, read-only audit across Neon PostgreSQL, GitHub Actions, application code, and runtime environments.

---

## 1. Executive Summary & Symptoms Triage

| Symptom | Description | Observed Reality (DB / Code Evidence) | Status |
| :--- | :--- | :--- | :--- |
| **S1** | 7 posts scheduled for today, 4 due, none posted. | **Partial / Refuted**: 1 post was generated today (`977e2b90` produced post `1d8a3ee0` at 12:32:19 IST). However, 1 slot expired (`5b7034ab` at 08:06 IST marked missed), and 2 slots (`9878a4e8` at 11:09 IST, `11e4fd0a` at 12:25 IST) became due without running because GitHub Actions schedule was delayed by GitHub's queue between 07:02 UTC and now. | **CONFIRMED** |
| **S2** | Telegram reports slot at 3:52, but admin Schedule page doesn't show it. | **CONFIRMED**: Telegram reported `09:22 IST (03:52 UTC)`. In the database, slot `977e2b90-a2fe-44c6-b823-9ca16663f41c` has `planned_at = 2026-11-07T03:52:00.000Z`. In `ScheduleQueueManager.tsx` line 210, the admin UI displayed it strictly as `03:52 UTC`, whereas Telegram formatted it as `09:22 IST (03:52 UTC)`. Furthermore, on the admin page, past completed slots are displayed without post titles or slot codes, making correlation impossible. | **CONFIRMED** |
| **S3** | "Active Topic Queue" list in admin is empty. | **CONFIRMED**: Database query `SELECT * FROM topic_queue;` returns exactly 0 rows. The automated system picks topics from live RSS feeds via `stepPickTopic()`, whereas `topic_queue` only receives rows when manually inserted via "Bulk Queue Import". | **CONFIRMED** |
| **S4** | Confusion regarding site time standard (UTC vs IST). | **CONFIRMED**: Severe inconsistencies across codebase. Database session is GMT/UTC, `DEFAULT_TIMEZONE=Asia/Kolkata`, slot generator uses UTC dates, admin UI displays UTC, Telegram formats IST + UTC, and public blog dates use server local time via `Intl.DateTimeFormat`. | **CONFIRMED** |
| **S5** | Lack of attribution linking slots to posts. | **CONFIRMED**: `post_slots.post_id` exists in schema, but there are no human-readable codes, no slot event history, no slot code on `posts`, and the admin UI does not render the linked post or status breakdown. | **CONFIRMED** |

---

## 2. Fact Collection (Evidence from Live Systems)

### A. Timezone & Environments
- **Neon PostgreSQL**: `SHOW timezone;` returns `GMT` (UTC).
- **Node Runtime**: `process.env.TZ = undefined`, system local date resolves to `Asia/Calcutta` (`GMT+0530`).
- **Environment Settings**: `DEFAULT_TIMEZONE = Asia/Kolkata` in `.env`.
- **Automation Settings Table**: `timezone = "Asia/Kolkata"`, `window_start = "02:30"`, `window_end = "11:30"`.
  *Note:* 02:30 UTC = 08:00 IST; 11:30 UTC = 17:00 IST (5:00 PM IST).
- **GitHub Actions**: Runs on UTC runners (`ubuntu-latest`). Workflow `.github/workflows/tick.yml` has cron: `"7,37 * * * *"`.
- **Vercel Runtime**: Node.js Serverless runtime (UTC default).

### B. Full Automation Settings Row (`automation_settings`)
```json
{
  "id": "4930bfc1-6163-4a07-a457-e385ec434c9b",
  "enabled": true,
  "paused_until": null,
  "timezone": "Asia/Kolkata",
  "mode": "auto_distribute",
  "posts_per_day": 7,
  "window_start": "02:30",
  "window_end": "11:30",
  "fixed_times": ["09:00", "18:00"],
  "weekdays": [0, 1, 2, 3, 4, 5, 6],
  "jitter_minutes": 15,
  "publish_mode": "auto",
  "content_mode": "trending",
  "max_posts_per_run": 1,
  "late_slot_grace_minutes": 240,
  "consecutive_failures": 0,
  "updated_at": "2026-11-07T07:03:18.622Z"
}
```

### C. Slots Breakdown (Nov 5 – Nov 8, 2026)
| Slot ID | Planned UTC | Planned IST | Status | Origin | Attempts | Post ID | Error / Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `68b80c71` | 2026-11-05 02:30 | 05 Nov 08:00 IST | `done` | auto | 1 | `d511df37` | Generated successfully |
| `710dd0ff` | 2026-11-05 04:46 | 05 Nov 10:16 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `137c2d3a` | 2026-11-05 07:33 | 05 Nov 13:03 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `1613ba33` | 2026-11-05 09:49 | 05 Nov 15:19 IST | `failed` | auto | 1 | null | Providers failed (Gemini 503, Groq token limit) |
| `6e621128` | 2026-11-05 12:36 | 05 Nov 18:06 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `59c48ab1` | 2026-11-05 14:52 | 05 Nov 20:22 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `01232d7d` | 2026-11-06 02:33 | 06 Nov 08:03 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `09748580` | 2026-11-06 04:49 | 06 Nov 10:19 IST | `done` | auto | 1 | `6d57e8db` | Generated successfully |
| `d99c0ed9` | 2026-11-06 07:36 | 06 Nov 13:06 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `5fb6eae6` | 2026-11-06 09:52 | 06 Nov 15:22 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `0c3a0764` | 2026-11-06 12:39 | 06 Nov 18:09 IST | `done` | auto | 1 | `8d79d353` | Generated successfully |
| `8804035d` | 2026-11-06 14:55 | 06 Nov 20:25 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `5b7034ab` | 2026-11-07 02:36 | 07 Nov 08:06 IST | `missed` | auto | 0 | null | Slot expired before execution |
| `977e2b90` | 2026-11-07 03:52 | 07 Nov 09:22 IST | `done` | auto | 1 | `1d8a3ee0` | Generated successfully (at 07:03 UTC) |
| `9878a4e8` | 2026-11-07 05:39 | 07 Nov 11:09 IST | `planned` | auto | 0 | null | Due (awaiting tick execution) |
| `11e4fd0a` | 2026-11-07 06:55 | 07 Nov 12:25 IST | `planned` | auto | 0 | null | Due (awaiting tick execution) |
| `38a831d2` | 2026-11-07 08:42 | 07 Nov 14:12 IST | `planned` | auto | 0 | null | Upcoming |
| `9aeb0cfd` | 2026-11-07 09:58 | 07 Nov 15:28 IST | `planned` | auto | 0 | null | Upcoming |
| `3257a860` | 2026-11-07 11:30 | 07 Nov 17:00 IST | `planned` | auto | 0 | null | Upcoming |

### D. GitHub Actions Execution Log
- Workflow file: `.github/workflows/tick.yml`
- Status: `active`
- Cron triggers: `7,37 * * * *` (every 30 mins)
- Verified API runs:
  - Run `42349538987` at `2026-11-07T07:02:03Z`: Success. Ran slot `977e2b90` (3:52 UTC), published post `1d8a3ee0`.
  - Next scheduled runs were queued/delayed by GitHub free tier concurrency.
  - Previous run `42322161786` at `2026-11-07T01:06:05Z`: Executed before window start (no due slots).

---

## 3. Hypothesis Testing & Verdicts

| Hypothesis | Verdict | Evidence |
| :--- | :--- | :--- |
| **H1: The workflow did not run, was disabled, or ran late.** | **CONFIRMED** | Workflow is `active`, but GitHub Actions scheduled triggers experience severe execution delays on free-tier queues. For example, run `42349538987` triggered at 07:02 UTC instead of 06:37 UTC, and subsequent triggers between 07:02 UTC and 13:00 UTC have not yet been dispatched by GitHub. |
| **H2: The tick ran but exited early.** | **REFUTED** | When tick executed at 07:02 UTC, it processed slot `977e2b90`, generated a post, and updated the DB. It only exited early when no slots were due. |
| **H3: Slots generated in wrong timezone.** | **CONFIRMED** | `calculateDaySlotTimes` in `src/services/scheduling/slots.ts` line 45-73 splits `dateStr` (e.g. `2026-11-07`) and uses `Date.UTC(year, month - 1, day, h, m)`. The window `02:30 - 11:30` stored in DB was intended to represent IST (08:00 AM to 05:00 PM), but because `calculateDaySlotTimes` ignores `settings.timezone` and assumes UTC, the window bounds are hardcoded in UTC, leading to confusion. |
| **H4: Due slots marked `missed` by grace window.** | **CONFIRMED** | `runner.ts` lines 100-120 and `slots.ts` lines 133-143 automatically mark planned slots as `missed` if they exceed `lateSlotGraceMinutes` (240 min). When GitHub Actions dropped ticks for 4+ hours, slots `5b7034ab` and several on Nov 5 & Nov 6 were expired into `missed`. |
| **H5: `max_posts_per_run` stopped processing.** | **CONFIRMED** | `automationSettings.max_posts_per_run` is set to `1` (`runner.ts` line 95, 124). When the runner finally woke up at 07:02 UTC with multiple overdue slots, it only processed **1 slot** (`977e2b90`) and left the remaining planned slots for future ticks. |
| **H6: Pipeline failed or saved drafts.** | **REFUTED** | Run `42349538987` published directly without drafts (`status: published`). The only failure was on Nov 5 (`1613ba33`) due to provider rate limits. |
| **H7: Saving settings in admin deleted/regenerated today's slots.** | **REFUTED** | `syncPostSlotsForDate` line 145-156 preserves running and completed slots, only regenerating unexecuted future slots if explicitly forced. |
| **H8: Duplicate or conflicting slots created.** | **REFUTED** | Total slots for Nov 7 = exactly 7 slots. No duplicate or overlapping timestamps exist. |
| **H9: Telegram and Admin page read different fields/timezones.** | **CONFIRMED** | In `telegram.ts` line 65 and `runner.ts` line 140, Telegram sends: `09:22 IST (03:52 UTC)`. In `ScheduleQueueManager.tsx` line 201-210, the admin table strictly outputs `{timeZone: "UTC"} UTC`. The user looked for "09:22" or "3:52" on an admin page that displayed "Thu, Nov 5 at 07:33 UTC" without IST conversions. |

---

## 4. Answers to Mandatory Questions (D1 – D5)

### D1: Time Standard Inconsistencies Across Codebase
- **Database (Neon)**: Stores `timestamptz` in UTC. Database session timezone is `GMT` (`SHOW timezone`).
- **Admin UI**:
  - `src/components/admin/ScheduleQueueManager.tsx:201-210`: Formats explicitly as UTC: `date.toLocaleTimeString("en-US", { timeZone: "UTC" }) UTC`.
  - `src/app/admin/page.tsx:156`: Formats as UTC: `Next slot: ... UTC`.
  - `src/app/admin/automation/page.tsx:51`: Uses client browser local time (`d.toLocaleTimeString("en-US", ...)` without fixed timezone).
  - `src/app/admin/runs/page.tsx:65`: Uses client browser local time.
- **Telegram Messages**:
  - `src/services/scheduling/runner.ts:137-141`: Manually adds `5.5 * 3600 * 1000` to format IST: `${istTimeStr} (${slotDate.toISOString().substring(11, 16)} UTC)`.
- **Slot Generation**:
  - `src/services/scheduling/slots.ts:45, 73, 103`: Uses `Date.UTC(...)`. It completely ignores `settings.timezone` ("Asia/Kolkata") and generates slots directly in UTC.
- **Public Blog Pages**:
  - `src/lib/utils/dates.ts:10-14`: Uses `new Intl.DateTimeFormat("en-US", ...)` which defaults to the server/browser host timezone!
- **GitHub Actions**: Runs on UTC runners (`cron: 7,37 * * * *`).

### D2: Blog Published Date Discrepancy (e.g. `gemini-omni-1-2-flash-video-generation`)
- **Stored Values**:
  - Post ID: `2000488f-8f58-4cec-b830-19dbf93605ad`
  - `published_at` in DB: `2026-11-06T20:01:01.521Z` (UTC)
  - In IST (Asia/Kolkata): `Nov 7, 2026, 01:31:01 AM IST`.
- **Formatting Code**:
  - In `src/app/(site)/blog/[slug]/page.tsx:173`: `<span>Published {formatDate(post.publishedAt)}</span>`
  - In `src/lib/utils/dates.ts:10-14`:
    ```ts
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
    ```
- **Why it showed yesterday's date**:
  Next.js Server Component rendered this on a Vercel/Node environment where the system timezone is **UTC**.
  Because `2026-11-06T20:01:01.521Z` has date `2026-11-06` in UTC, `Intl.DateTimeFormat` rendered **"Nov 6, 2026"**, even though in the creator's timezone (IST) it was already **Nov 7, 2026 (01:31 AM)**.

### D3: Cover Caption Source
- **Code Location**: `src/services/images/cover.ts:46`
- **Source**: Hardcoded string literal in Cloudflare cover generation:
  ```ts
  credit: "Generated with Cloudflare Workers AI Flux-1",
  ```
- Saved into `posts.coverCredit` (`src/services/pipeline/steps/save.ts:110`) and rendered on the blog page in `src/app/(site)/blog/[slug]/page.tsx:224`:
  ```tsx
  {post.coverCredit && (
    <figcaption className="absolute bottom-2 right-2 ...">
      {post.coverCredit}
    </figcaption>
  )}
  ```

### D4: Topic Queue Analysis
- **Code & Filter**: `src/app/admin/schedule/page.tsx:27` queries:
  ```ts
  db.query.topicQueue.findMany({
    orderBy: [desc(topicQueue.priority), desc(topicQueue.createdAt)],
    limit: 30,
  })
  ```
- **Why it is empty**: The table `topic_queue` currently contains 0 records in Neon DB.
- **Original Design vs Reality**:
  - The autonomous engine (`stepPickTopic()` in `src/services/pipeline/steps/pick-topic.ts:19`) pulls trending news directly from external RSS feeds and Hacker News. It never reads from `topic_queue`!
  - `topic_queue` was designed as a manual backlog (populated via "Bulk Queue Import" on `/admin/schedule`), but `runDailyPipeline()` has no logic to consume items from `topic_queue`.
- **Required Behavior (R5)**:
  `stepPickTopic` must check `topic_queue` first for pending manual topics (`status: "queued"`). If any exist, consume the highest-priority queued topic; otherwise, fall back to autonomous RSS trending discovery. The UI will provide tabs for Active, Done, and Failed topics.

### D5: Telegram vs Admin Slot Time Mismatch
- **Database Slot Row**: `id = 977e2b90-a2fe-44c6-b823-9ca16663f41c`, `planned_at = 2026-11-07 03:52:00.000Z`.
- **Telegram Formatter** (`src/services/scheduling/runner.ts:137-141`):
  Converts UTC to IST by adding 5.5 hours:
  `const istTimeStr = ...; slotTimeDisplay = "09:22 IST (03:52 UTC)"` -> Sent to Telegram!
- **Admin Schedule Page** (`src/components/admin/ScheduleQueueManager.tsx:201-210`):
  Formats using `timeZone: "UTC"`:
  `Sat, Nov 7 at 03:52 UTC`
- **Result**: Telegram reported "09:22 IST", while Admin showed "03:52 UTC". There was no indication that both referred to the exact same slot.

---

## 5. Architectural Fix Plan (Requirements R1 – R7)

1. **R1: Single Source of Time (`src/lib/time/`)**
   - Implement `src/lib/time/index.ts` using `date-fns` / standard UTC-safe arithmetic to format site time (Asia/Kolkata by default, configurable).
   - Functions: `toSiteTime`, `formatSiteDate`, `formatSiteDateTime`, `siteDayBounds`, `localToUtc`.
   - Update admin UI, Telegram builders, and runner to strictly use this module.
2. **R2: Human-Readable Meaningful Slot Codes**
   - Generate slot codes: `{SITE}-{YYYYMMDD}-{HHmm}-{CAT}-{O}{NN}` (e.g. `FA-20261107-0922-AI-A02`).
   - Add category short code column (additive migration).
   - Reference slot codes across runs, notifications, and logs.
3. **R3: Admin Schedule Page Redesign**
   - Group slots by site-time date (e.g. "Sat 7 Nov 2026 · 7 slots · 1 done · 2 due · 4 planned").
   - Display slot code, time in IST with UTC on hover, category, origin, status badge, linked post title.
   - Add multi-select, bulk actions (Run Now, Reschedule, Skip, Delete).
4. **R4: Slot Lifecycle State Machine & Logging**
   - Add `slot_events` table (additive migration) to audit every state transition (`planned -> running -> done | missed | failed | skipped`).
5. **R5: Topic Queue Integration**
   - Wire `topic_queue` into `stepPickTopic`: prioritize pinned manual topics if queued, otherwise auto-discover trending items.
   - Provide Active, Done, and Failed tabs in Admin.
6. **R6: Enhanced Telegram Notifications**
   - Pure builder in `src/services/notify/messages/`.
   - Detail credits used per provider and estimated daily remaining quota.
   - Run reports for work done, failed steps, and next upcoming slot.
7. **R7: Comprehensive Database Audit Logging**
   - Add `notification_log` and `tick_runs` tables.
   - Add tick CLI flags `--dry-run` and `--simulate-at <ISO>`.
