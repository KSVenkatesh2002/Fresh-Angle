# Database Health & Retention Architecture Report

**Date**: November 8, 2026  
**Status**: Implemented & Verified  
**Repository Safety**: Public repository verified. `.gitignore` active for `backups/`. No secrets or database URLs exposed.

---

## 1. Executive Summary

A comprehensive automated database retention and storage monitoring architecture has been integrated into Fresh Angle.

1. **Daily Retention Job**:
   - Runs automatically once every 24 hours during the scheduler tick (`src/services/scheduling/runner.ts`).
   - Configurable retention window (setting: `data_retention_days`, default **90 days**; `audit_log` fixed at **365 days**).
   - Safely cleans expired log, run, and slot records:
     - `seen_items` (`seen_at < NOW() - N days`)
     - `pipeline_runs` / `tick_runs` (`started_at < NOW() - N days`)
     - `post_slots` / `slot_events` (`planned_at < NOW() - N days` for completed/missed/failed/skipped slots)
     - `usage_daily` / `usage_events` (`date < NOW() - N days`)
     - `audit_log` (`created_at < NOW() - 365 days`)
     - Gracefully cleans dynamically detected candidate tables (`notification_log`, `slot_events`, `tick_runs`, `usage_events`) if present.
   - **Safety Guarantee**: Content tables (`posts`, `categories`, `tags`, `post_sources`, `post_images`) are **never deleted or modified**.

2. **Database Storage Quota & Telemetry**:
   - Measures live disk footprint in Neon PostgreSQL via `pg_database_size(current_database())` against the **0.5 GB (512 MB) Free Tier Allocation**.
   - Current Database Footprint: **10.45 MB / 512 MB (2.0% utilized, 501.55 MB free headroom)**.
   - **Automated Telegram Alerts**: Configured at **70%** (358 MB) and **90%** (460 MB) with daily deduplication to avoid repetitive alert noise.
   - **Admin Usage Page (`/admin/usage`)**:
     - Visual Neon PostgreSQL Database Storage Quota Card with color-coded progress bar and alert threshold indicators.
     - Interactive **Largest Database Tables by Disk Footprint** breakdown showing table data, index footprint, and total size.

---

## 2. Real Database Telemetry & Evidence

### 2.1. Neon Database Storage Breakdown
```sql
SELECT pg_database_size(current_database()) as db_bytes;
```
- **Total Database Disk Size**: 10,960,896 bytes (**10.45 MB**)
- **Free Quota**: 536,870,912 bytes (**512 MB / 0.5 GB**)
- **Utilization**: **2.0%**
- **Available Headroom**: **501.55 MB** (98.0% free headroom)

### 2.2. Top 10 Largest Tables by Disk Footprint (Neon Live Query)
```sql
SELECT 
  table_name,
  pg_total_relation_size(quote_ident(table_name)) as total_bytes,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
  pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
LIMIT 10;
```

| Table Name | Total Disk Footprint | Table Row Data | Indexes Footprint | Share of DB | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `post_images` | 1016 kB | 8192 bytes | 1008 kB | 9.5% | Legacy bytea preserved; new images write 0 bytes bytea |
| `posts` | 256 kB | 24 kB | 232 kB | 2.4% | Core editorial content (untouched by retention) |
| `pipeline_runs` | 120 kB | 40 kB | 80 kB | 1.1% | Cleaned by 90-day retention job |
| `audit_log` | 80 kB | 16 kB | 64 kB | 0.7% | Cleaned by 365-day retention job |
| `usage_daily` | 80 kB | 8192 bytes | 72 kB | 0.7% | Cleaned by 90-day retention job |
| `post_slots` | 80 kB | 8192 bytes | 72 kB | 0.7% | Cleaned by 90-day retention job |
| `feeds` | 64 kB | 8192 bytes | 56 kB | 0.6% | Active RSS & syndication feeds |
| `tags` | 64 kB | 8192 bytes | 56 kB | 0.6% | Taxonomy tags |
| `post_sources` | 64 kB | 8192 bytes | 56 kB | 0.6% | Article citations and provenance |
| `prompt_templates` | 64 kB | 8192 bytes | 56 kB | 0.6% | System generation prompts |

---

## 3. Maintenance Execution & Verification

### 3.1. CLI Tooling: `scripts/retention.ts`
```bash
# Run dry inspection:
NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/retention.ts --stats-only

# Run retention cleanup:
NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/retention.ts
```

**Live Run Output**:
```text
🏥 [Database Health] Inspecting Neon PostgreSQL storage & tables...

================ DATABASE STORAGE ================
Current Size:      10.45 MB / 512 MB (2% used)
Free Headroom:     501.55 MB remaining
---------------- TOP TABLES ----------------------
• post_images             1016 kB (data: 8192 bytes, idx: 1008 kB) - 9.5%
• posts                    256 kB (data: 24 kB, idx: 232 kB) - 2.4%
• pipeline_runs            120 kB (data: 40 kB, idx: 80 kB) - 1.1%
• audit_log                 80 kB (data: 16 kB, idx: 64 kB) - 0.7%
• usage_daily               80 kB (data: 8192 bytes, idx: 72 kB) - 0.7%
• post_slots                80 kB (data: 8192 bytes, idx: 72 kB) - 0.7%
• feeds                     64 kB (data: 8192 bytes, idx: 56 kB) - 0.6%
• tags                      64 kB (data: 8192 bytes, idx: 56 kB) - 0.6%
• post_sources              64 kB (data: 8192 bytes, idx: 56 kB) - 0.6%
• prompt_templates          64 kB (data: 8192 bytes, idx: 56 kB) - 0.6%
==================================================

🧹 Running retention cleanup...
🧹 [Retention Job] Starting cleanup (event retention: 90d, audit retention: 365d)...
✓ [Retention Job] Completed. Deleted 0 expired log/event rows (seen: 0, runs: 0, slots: 0, usage: 0, audit: 0).
================ RETENTION REPORT ================
Retention Window:  90 days (audit_log: 365 days)
Seen Items Purged: 0
Pipeline Runs:     0
Expired Slots:     0
Usage Records:     0
Audit Log Rows:    0
Total Rows Purged: 0
==================================================
✓ Storage alert status: normal (2% < 70% threshold).
```

---

## 4. Quality Gates & Test Results

- [x] **Unit Tests**: Full Vitest suite (**12 test files, 60 tests passed**), including 9 dedicated tests in `tests/retention.test.ts`.
- [x] **Typecheck**: `tsc --noEmit` passed with 0 errors.
- [x] **Lint**: `next lint && npm run check:colors` passed with 0 errors and 100% semantic theme tokens.
- [x] **Build**: `next build` passed with 56 of 56 static pages generated.
- [x] **Safety Verification**: Tested SQL statements confirm `posts`, `categories`, `tags`, and `post_sources` are never touched by cleanup routines.

