import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveAutoPublish } from "@/services/pipeline/auto-publish";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockGetDb = vi.fn();
const mockCreatePostWithRelations = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/db/queries/posts", () => ({
  createPostWithRelations: (...args: unknown[]) =>
    mockCreatePostWithRelations(...args),
}));

vi.mock("@/db/queries/categories", () => ({
  upsertCategory: vi.fn().mockResolvedValue({ id: "cat-1", slug: "ai", name: "AI" }),
}));

vi.mock("@/db/queries/tags", () => ({
  getOrCreateTags: vi.fn().mockResolvedValue([{ id: "tag-1", name: "LLM" }]),
}));

vi.mock("@/services/storage/cloudinary", () => ({
  getImageStorage: () => ({
    put: vi.fn().mockResolvedValue({
      publicUrl: "https://cdn.example.com/cover.webp",
      storageKey: "cover",
      width: 1200,
      height: 630,
      bytes: 1024,
    }),
  }),
}));

vi.mock("@/services/seo/internal-links", () => ({
  fetchPublishedLinkTargets: vi.fn().mockResolvedValue([]),
  injectContextualInternalLinks: vi.fn((md: string) => ({
    enrichedMd: md,
    injectedLinks: [],
  })),
  recordPostLinks: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/services/seo/indexnow", () => ({
  pingIndexNow: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
}));

vi.mock("@/services/notify/telegram", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/maintenance/database", () => ({
  runDailyDatabaseMaintenance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/scheduling/watchdog", () => ({
  checkTickDisruptionAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/maintenance/database", () => ({
  runDailyDatabaseMaintenance: vi.fn().mockResolvedValue(undefined),
}));

describe("Phase 1: Auto-publish switch and holdReason", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AUTO_PUBLISH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("DB publishMode overrides AUTO_PUBLISH env (OFF wins over AUTO_PUBLISH=true, ON wins over false)", async () => {
    process.env.AUTO_PUBLISH = "true";
    mockGetDb.mockReturnValue({
      select: () => ({
        from: () => ({
          limit: vi.fn().mockResolvedValue([{ publishMode: "review" }]),
        }),
      }),
    });
    expect(await resolveAutoPublish()).toBe(false);

    process.env.AUTO_PUBLISH = "false";
    mockGetDb.mockReturnValue({
      select: () => ({
        from: () => ({
          limit: vi.fn().mockResolvedValue([{ publishMode: "auto" }]),
        }),
      }),
    });
    expect(await resolveAutoPublish()).toBe(true);
  });

  it("falls back to AUTO_PUBLISH env when DB has no automation_settings row, and defaults to false on DB error", async () => {
    process.env.AUTO_PUBLISH = "true";
    mockGetDb.mockReturnValue({
      select: () => ({
        from: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    expect(await resolveAutoPublish()).toBe(true);

    mockGetDb.mockImplementation(() => {
      throw new Error("DB connection failed");
    });
    expect(await resolveAutoPublish()).toBe(false);
  });

  it("always keeps test runs as draft regardless of DB or env", async () => {
    process.env.AUTO_PUBLISH = "true";
    expect(await resolveAutoPublish({ isTest: true })).toBe(false);
  });

  it("stepSave sets status/holdReason accurately for ON, OFF, originality gate failure, and test runs", async () => {
    const { stepSave } = await import("@/services/pipeline/steps/save");

    mockGetDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: vi.fn().mockResolvedValue([{ id: "img-1" }]),
        }),
      }),
    });
    mockCreatePostWithRelations.mockImplementation(async (arg: { post: Record<string, unknown> }) => ({
      id: "post-1",
      ...arg.post,
    }));

    const basePost = {
      title: "Sample Technical Post",
      excerpt: "Sample excerpt covering benchmark details cleanly.",
      contentMd: "## Overview\n\nDetailed engineering breakdown.",
      metaTitle: "Sample Technical Post",
      metaDescription: "Sample meta description of sufficient length for SEO.",
      category: "Artificial Intelligence",
      tags: ["LLM", "AI", "Inference"],
      slug: "sample-technical-post",
      imagePrompt: "Abstract GPU cluster visualization",
      imageAlt: "GPU cluster render",
      faq: [
        { question: "What is it?", answer: "A sample test article." },
        { question: "Why test?", answer: "To verify pipeline hold reasons." },
      ],
    };
    const baseCover = {
      buffer: Buffer.from("fake-image"),
      alt: "Cover alt",
      credit: undefined,
      source: "ai" as const,
    };

    // 1. Auto-publish ON + passed gates -> published, holdReason null
    const pub = await stepSave({
      post: { ...basePost },
      cover: baseCover,
      sources: [],
      aiProvider: "gemini",
      aiModel: "gemini-3.5-flash-lite",
      autoPublish: true,
    });
    expect(pub.status).toBe("published");
    expect(pub.holdReason).toBeNull();

    // 2. Auto-publish OFF -> draft with holdReason auto_publish_off
    const offDraft = await stepSave({
      post: { ...basePost },
      cover: baseCover,
      sources: [],
      aiProvider: "gemini",
      aiModel: "gemini-3.5-flash-lite",
      autoPublish: false,
    });
    expect(offDraft.status).toBe("draft");
    expect(offDraft.holdReason).toBe("auto_publish_off");

    // 3. Auto-publish ON + originality gate failure -> draft with holdReason originality_gate
    const gatedPost = { ...basePost, status: "needs_review" };
    const gateDraft = await stepSave({
      post: gatedPost as typeof basePost,
      cover: baseCover,
      sources: [],
      aiProvider: "gemini",
      aiModel: "gemini-3.5-flash-lite",
      autoPublish: true,
      holdReason: "originality_gate",
      holdDetail: "3-gram overlap 8.2% > 5%",
    });
    expect(gateDraft.status).toBe("draft");
    expect(gateDraft.holdReason).toBe("originality_gate");
    expect(gateDraft.holdDetail).toContain("3-gram overlap");

    // 4. Test run -> draft with holdReason test
    const testDraft = await stepSave({
      post: { ...basePost },
      cover: baseCover,
      sources: [],
      aiProvider: "gemini",
      aiModel: "gemini-3.5-flash-lite",
      autoPublish: true,
      isTest: true,
    });
    expect(testDraft.status).toBe("draft");
    expect(testDraft.holdReason).toBe("test");
  });

  it("clears holdReason when updatePostStatus publishes a draft", async () => {
    const returningMock = vi.fn().mockResolvedValue([
      { id: "post-1", status: "published", holdReason: null, holdDetail: null },
    ]);
    const whereMock = vi.fn(() => ({ returning: returningMock }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    mockGetDb.mockReturnValue({ update: vi.fn(() => ({ set: setMock })) });

    const { updatePostStatus } = await import("@/db/queries/posts-write");
    const updated = await updatePostStatus("post-1", "published");

    expect(updated.status).toBe("published");
    expect(updated.holdReason).toBeNull();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        holdReason: null,
        holdDetail: null,
      }),
    );
  });

  it("runSchedulerTick still publishes due manually scheduled posts even when publishMode is 'review' (OFF)", async () => {
    const mockDbUpdateSet = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    mockUpdate.mockReturnValue({ set: mockDbUpdateSet });
    mockSelect.mockReturnValue({
      from: () => ({
        limit: vi.fn().mockResolvedValue([
          {
            id: "set-1",
            enabled: true,
            pausedUntil: null,
            publishMode: "review", // Auto-publish OFF
            mode: "auto_distribute" as const,
            postsPerDay: 3,
            windowStart: "02:30",
            windowEnd: "11:30",
            fixedTimes: ["09:00", "18:00"],
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            weekdayOverrides: {},
            jitterMinutes: 15,
            timezone: "Asia/Kolkata",
            maxPostsPerRun: 2,
            lateSlotGraceMinutes: 360,
          },
        ]),
      }),
    });

    mockGetDb.mockReturnValue({
      execute: vi.fn().mockResolvedValue({ rows: [{ locked: true }] }),
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
          returning: vi.fn().mockResolvedValue([]),
        }),
      })),
      select: mockSelect,
      update: mockUpdate,
      query: {
        settings: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        postSlots: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        posts: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "sched-post-1",
              slug: "manual-scheduled-post",
              title: "Manual Scheduled Post",
              status: "scheduled",
              scheduledFor: new Date(Date.now() - 60_000),
            },
          ]),
        },
        dateOverrides: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    });

    const { runSchedulerTick } = await import("@/services/scheduling/runner");
    const result = await runSchedulerTick();

    expect(result.executed).toBe(true);
    expect(result.publishedCount).toBe(1);
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" }),
    );
  });
});

