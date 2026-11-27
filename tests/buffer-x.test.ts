import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  computeXWeightedLength,
  formatXPostText,
  postArticleToX,
  resetBufferChannelCache,
} from "../src/services/notify/buffer";
import { TimeoutError } from "../src/lib/utils/http";

const mockGetDb = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => mockGetDb(),
}));

interface MockPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  categoryId: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  origin: "auto" | "manual" | "queue" | "test";
  xPostStatus: "pending" | "posting" | "posted" | "failed" | "skipped" | null;
  xPostId: string | null;
}

function setupMockDb(
  postRow: MockPostRow | null,
  options: { claimSucceeds?: boolean } = {},
) {
  const updatedPayloads: Array<Record<string, unknown>> = [];
  const claimSucceeds = options.claimSucceeds ?? true;

  let selectCall = 0;
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockImplementation(async () => {
            selectCall++;
            if (selectCall === 1) {
              return postRow ? [postRow] : [];
            }
            return [{ name: "Artificial Intelligence" }];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: Record<string, unknown>) => {
        updatedPayloads.push(vals);
        return {
          where: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue(
                vals.xPostStatus === "posting" && claimSucceeds
                  ? [{ id: postRow?.id ?? "post-1" }]
                  : [],
              ),
          })),
        };
      }),
    })),
  };

  mockGetDb.mockReturnValue(mockDb);
  return { mockDb, updatedPayloads };
}

describe("Phase 2: Buffer X (Twitter) Auto-Posting", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetBufferChannelCache();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ENABLE_X_POSTING = "true";
    delete process.env.BUFFER_API_KEY;
    delete process.env.BUFFER_X_CHANNEL_ID;
    delete process.env.BUFFER_X_MODE;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("enforces <= 280 weighted chars counting any https URL as 23 chars", () => {
    const longUrl =
      "https://freshangle.vercel.app/blog/extremely-long-slug-that-would-exceed-280-if-counted-raw-for-distributed-systems-and-quantization";
    const text = formatXPostText({
      title:
        "Distributed Inference Optimization And Quantization Across Multi-Node Clusters: Full Architecture Guide And Empirical Latency Analysis For Engineering Teams",
      url: longUrl,
      excerpt: "Detailed analysis of inference latency and KV cache throughput.",
      category: "Machine Learning",
      variantSeed: "seed-1",
    });

    expect(computeXWeightedLength(text)).toBeLessThanOrEqual(280);
    expect(text).toContain(longUrl);
  });

  it("skips drafts cleanly without calling Buffer", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    setupMockDb({
      id: "p1",
      slug: "draft-post",
      title: "Draft Post",
      excerpt: "Excerpt",
      categoryId: null,
      status: "draft",
      origin: "auto",
      xPostStatus: null,
      xPostId: null,
    });

    const res = await postArticleToX("p1");
    expect(res.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips origin='test' posts cleanly without calling Buffer", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { updatedPayloads } = setupMockDb({
      id: "p1",
      slug: "test-post",
      title: "[TEST] Test Post",
      excerpt: "Excerpt",
      categoryId: null,
      status: "published",
      origin: "test",
      xPostStatus: null,
      xPostId: null,
    });

    const res = await postArticleToX("p1");
    expect(res.skipped).toBe(true);
    expect(res.status).toBe("skipped");
    expect(updatedPayloads[0]).toMatchObject({ xPostStatus: "skipped" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips and marks missing BUFFER_API_KEY without throwing", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { updatedPayloads } = setupMockDb({
      id: "p1",
      slug: "pub-post",
      title: "Published Post",
      excerpt: "Excerpt",
      categoryId: null,
      status: "published",
      origin: "auto",
      xPostStatus: null,
      xPostId: null,
    });

    const res = await postArticleToX("p1");
    expect(res.skipped).toBe(true);
    expect(res.status).toBe("skipped");
    expect(res.message).toContain("BUFFER_API_KEY");
    expect(updatedPayloads[0]).toMatchObject({ xPostStatus: "skipped" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stores xPostId and xPostedAt on successful Buffer createPost", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { createPost: { post: { id: "buf_123", status: "sent" } } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const { updatedPayloads } = setupMockDb({
      id: "p1",
      slug: "pub-post",
      title: "Published Post",
      excerpt: "Technical summary here.",
      categoryId: "cat-1",
      status: "published",
      origin: "auto",
      xPostStatus: null,
      xPostId: null,
    });

    const res = await postArticleToX("p1", { retryDelayMs: 0 });
    expect(res.success).toBe(true);
    expect(res.status).toBe("posted");
    expect(res.xPostId).toBe("buf_123");

    const finalUpdate = updatedPayloads[updatedPayloads.length - 1];
    expect(finalUpdate).toMatchObject({
      xPostStatus: "posted",
      xPostId: "buf_123",
      xPostError: null,
    });
    expect(finalUpdate.xPostedAt).toBeInstanceOf(Date);
  });

  it("retries 5xx up to 3 times then marks failed", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";

    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response("Internal Server Error", { status: 502 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { updatedPayloads } = setupMockDb({
      id: "p1",
      slug: "retry-5xx",
      title: "Retry 5xx Post",
      excerpt: "Excerpt",
      categoryId: null,
      status: "published",
      origin: "auto",
      xPostStatus: null,
      xPostId: null,
    });

    const res = await postArticleToX("p1", { retryDelayMs: 0 });
    expect(res.success).toBe(false);
    expect(res.status).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(updatedPayloads[updatedPayloads.length - 1]).toMatchObject({
      xPostStatus: "failed",
    });
  });

  it("does NOT retry on timeout and marks 'unknown - check X before retrying'", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";

    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      if (init?.signal?.aborted) {
        throw new TimeoutError("https://api.buffer.com", 10000);
      }
      throw new TimeoutError("https://api.buffer.com", 10000);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { updatedPayloads } = setupMockDb({
      id: "p1",
      slug: "timeout-post",
      title: "Timeout Post",
      excerpt: "Excerpt",
      categoryId: null,
      status: "published",
      origin: "auto",
      xPostStatus: null,
      xPostId: null,
    });

    const res = await postArticleToX("p1", { retryDelayMs: 0 });
    expect(res.success).toBe(false);
    expect(res.status).toBe("failed");
    expect(res.message).toContain("unknown - check X before retrying");
    expect(fetchMock).toHaveBeenCalledTimes(1); // NEVER retry timeout
    expect(updatedPayloads[updatedPayloads.length - 1]).toMatchObject({
      xPostStatus: "failed",
      xPostError: expect.stringContaining("unknown - check X before retrying"),
    });
  });

  it("exits silently when concurrent second caller fails atomic claim", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    setupMockDb(
      {
        id: "p1",
        slug: "concurrent-post",
        title: "Concurrent Post",
        excerpt: "Excerpt",
        categoryId: null,
        status: "published",
        origin: "auto",
        xPostStatus: "posting",
        xPostId: null,
      },
      { claimSucceeds: false },
    );

    const res = await postArticleToX("p1");
    expect(res.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never re-posts an article already marked 'posted' (even after unpublish/republish)", async () => {
    process.env.BUFFER_API_KEY = "buf_key";
    process.env.BUFFER_X_CHANNEL_ID = "ch_x";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    setupMockDb({
      id: "p1",
      slug: "already-posted",
      title: "Already Posted",
      excerpt: "Excerpt",
      categoryId: null,
      status: "published",
      origin: "auto",
      xPostStatus: "posted",
      xPostId: "buf_existing",
    });

    const res = await postArticleToX("p1");
    expect(res.skipped).toBe(true);
    expect(res.status).toBe("posted");
    expect(res.xPostId).toBe("buf_existing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
