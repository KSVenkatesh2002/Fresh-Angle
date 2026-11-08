import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRetentionDaysSetting,
  getDatabaseStorageStats,
  checkDatabaseStorageAlerts,
  runDatabaseRetentionJob,
  FREE_TIER_DATABASE_LIMIT_BYTES,
  DEFAULT_RETENTION_DAYS,
  AUDIT_LOG_RETENTION_DAYS,
} from "@/services/maintenance/database";
import * as dbModule from "@/db/client";
import * as telegramModule from "@/services/notify/telegram";

describe("Database Health & Retention Maintenance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constants & Configuration", () => {
    it("has 0.5 GB free limit defined as 512 MB", () => {
      expect(FREE_TIER_DATABASE_LIMIT_BYTES).toBe(512 * 1024 * 1024);
    });

    it("has 90 days default retention and 365 days audit retention", () => {
      expect(DEFAULT_RETENTION_DAYS).toBe(90);
      expect(AUDIT_LOG_RETENTION_DAYS).toBe(365);
    });
  });

  describe("getRetentionDaysSetting", () => {
    it("returns configured days from settings table if present", async () => {
      const mockDb = {
        query: {
          settings: {
            findFirst: vi.fn().mockResolvedValue({ key: "data_retention_days", value: "60" }),
          },
        },
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const days = await getRetentionDaysSetting();
      expect(days).toBe(60);
    });

    it("falls back to default 90 days if setting not found or invalid", async () => {
      const mockDb = {
        query: {
          settings: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const days = await getRetentionDaysSetting();
      expect(days).toBe(90);
    });
  });

  describe("getDatabaseStorageStats", () => {
    it("calculates accurate MB, percentage, and headroom from pg_database_size", async () => {
      const mockDb = {
        execute: vi.fn().mockImplementation((queryObj) => {
          const sqlStr = String(queryObj?.queryChunks?.[0]?.value || "");
          if (sqlStr.includes("pg_database_size")) {
            return Promise.resolve({
              rows: [{ db_bytes: String(10485760) }], // 10 MB
            });
          }
          // Top tables query
          return Promise.resolve({
            rows: [
              {
                table_name: "post_images",
                total_bytes: "1040384",
                total_size: "1016 kB",
                table_size: "8192 bytes",
                index_size: "1008 kB",
              },
              {
                table_name: "posts",
                total_bytes: "262144",
                total_size: "256 kB",
                table_size: "24 kB",
                index_size: "232 kB",
              },
            ],
          });
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const stats = await getDatabaseStorageStats();
      expect(stats.usedBytes).toBe(10485760);
      expect(stats.usedMb).toBe(10);
      expect(stats.limitMb).toBe(512);
      expect(stats.percentUsed).toBe(2);
      expect(stats.headroomMb).toBe(502);
      expect(stats.topTables).toHaveLength(2);
      expect(stats.topTables[0].tableName).toBe("post_images");
    });
  });

  describe("checkDatabaseStorageAlerts", () => {
    it("triggers 70% Telegram alert when storage exceeds 70% and suppresses duplicates", async () => {
      const alertSpy = vi.spyOn(telegramModule, "sendDatabaseStorageAlert").mockResolvedValue(true);
      const today = new Date().toISOString().split("T")[0];

      const mockDb = {
        query: {
          settings: {
            findFirst: vi.fn().mockResolvedValue(null), // Alert not sent today
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue({}),
          }),
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const stats = {
        usedBytes: 380000000,
        limitBytes: 512 * 1024 * 1024,
        usedMb: 362.4,
        limitMb: 512,
        percentUsed: 70.8,
        headroomMb: 149.6,
        topTables: [],
      };

      const res = await checkDatabaseStorageAlerts(stats);
      expect(res.alerted).toBe(true);
      expect(res.threshold).toBe(70);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 70,
          percent: 70.8,
        }),
      );
    });

    it("triggers 90% Telegram alert when storage exceeds 90%", async () => {
      const alertSpy = vi.spyOn(telegramModule, "sendDatabaseStorageAlert").mockResolvedValue(true);

      const mockDb = {
        query: {
          settings: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue({}),
          }),
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const stats = {
        usedBytes: 480000000,
        limitBytes: 512 * 1024 * 1024,
        usedMb: 457.7,
        limitMb: 512,
        percentUsed: 93.8,
        headroomMb: 54.3,
        topTables: [],
      };

      const res = await checkDatabaseStorageAlerts(stats);
      expect(res.alerted).toBe(true);
      expect(res.threshold).toBe(90);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 90,
          percent: 93.8,
        }),
      );
    });

    it("suppresses alert if already triggered today", async () => {
      const alertSpy = vi.spyOn(telegramModule, "sendDatabaseStorageAlert").mockResolvedValue(true);
      const today = new Date().toISOString().split("T")[0];

      const mockDb = {
        query: {
          settings: {
            findFirst: vi.fn().mockResolvedValue({ key: "last_db_alert_70_date", value: today }),
          },
        },
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const stats = {
        usedBytes: 380000000,
        limitBytes: 512 * 1024 * 1024,
        usedMb: 362.4,
        limitMb: 512,
        percentUsed: 70.8,
        headroomMb: 149.6,
        topTables: [],
      };

      const res = await checkDatabaseStorageAlerts(stats);
      expect(res.alerted).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe("runDatabaseRetentionJob", () => {
    it("deletes expired rows from log and event tables without touching content tables", async () => {
      const executedQueries: string[] = [];
      const mockDb = {
        query: {
          settings: {
            findFirst: vi.fn().mockResolvedValue({ key: "data_retention_days", value: "90" }),
          },
        },
        execute: vi.fn().mockImplementation((queryObj) => {
          const raw = JSON.stringify(queryObj);
          executedQueries.push(raw);

          // Return 5 deleted items for each table
          return Promise.resolve({
            rows: [{ count: "5" }],
          });
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.spyOn(dbModule, "getDb").mockReturnValue(mockDb as any);

      const result = await runDatabaseRetentionJob(90);

      expect(result.success).toBe(true);
      expect(result.retentionDays).toBe(90);
      expect(result.auditRetentionDays).toBe(365);
      expect(result.deletedCounts.seenItems).toBe(5);
      expect(result.deletedCounts.pipelineRuns).toBe(5);
      expect(result.deletedCounts.postSlots).toBe(5);
      expect(result.deletedCounts.usageDaily).toBe(5);
      expect(result.deletedCounts.auditLog).toBe(5);

      // Verify safety: query strings must NEVER contain DELETE FROM posts, categories, tags, post_sources
      const allExecutedSql = executedQueries.join(" ");
      expect(allExecutedSql).not.toContain("DELETE FROM posts");
      expect(allExecutedSql).not.toContain("DELETE FROM categories");
      expect(allExecutedSql).not.toContain("DELETE FROM tags");
      expect(allExecutedSql).not.toContain("DELETE FROM post_sources");
    });
  });
});

