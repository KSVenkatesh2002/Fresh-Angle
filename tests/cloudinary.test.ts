import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildDeterministicPublicId,
  CloudinaryImageStorage,
} from "@/services/storage/cloudinary";
import {
  getCoverImageUrl,
  getAbsoluteCoverImageUrl,
  cloudinaryLoader,
} from "@/lib/images/helpers";

describe("Cloudinary Image Storage & URL Helpers", () => {
  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    process.env.CLOUDINARY_FOLDER = "test-folder/covers";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildDeterministicPublicId", () => {
    it("generates deterministic public_id with yyyy/mm/slug-hash format", () => {
      const buffer = Buffer.from("fake-webp-image-bytes");
      const fixedDate = new Date("2026-11-08T00:00:00Z");

      const publicId1 = buildDeterministicPublicId(
        "fresh-angle/covers",
        "sample-post-slug",
        buffer,
        fixedDate,
      );
      const publicId2 = buildDeterministicPublicId(
        "fresh-angle/covers",
        "sample-post-slug",
        buffer,
        fixedDate,
      );

      // Same inputs produce identical hash and key
      expect(publicId1).toBe(publicId2);
      expect(publicId1).toMatch(
        /^fresh-angle\/covers\/2026\/11\/sample-post-slug-[a-f0-9]{8}$/,
      );
    });

    it("sanitizes special characters in slug", () => {
      const buffer = Buffer.from("image-content");
      const fixedDate = new Date("2026-11-08T00:00:00Z");

      const publicId = buildDeterministicPublicId(
        "fresh-angle/covers",
        "AI & Future: What's Next?!",
        buffer,
        fixedDate,
      );

      expect(publicId).not.toContain("&");
      expect(publicId).not.toContain("?");
      expect(publicId).not.toContain(":");
      expect(publicId).not.toContain(" ");
      expect(publicId).toMatch(
        /^fresh-angle\/covers\/2026\/11\/ai---future--what-s-next---[a-f0-9]{8}$/,
      );
    });
  });

  describe("getCoverImageUrl", () => {
    it("returns coverImageUrl when available", () => {
      const url = getCoverImageUrl({
        coverImageUrl: "https://res.cloudinary.com/demo/image/upload/sample.webp",
        coverImageId: "some-uuid",
      });
      expect(url).toBe(
        "https://res.cloudinary.com/demo/image/upload/sample.webp",
      );
    });

    it("falls back to legacy /api/images/[id] if coverImageUrl is missing", () => {
      const url = getCoverImageUrl({
        coverImageUrl: null,
        coverImageId: "abc-123",
      });
      expect(url).toBe("/api/images/abc-123");
    });

    it("falls back to default branded static cover if post has neither", () => {
      expect(getCoverImageUrl(null)).toBe("/images/fallback-cover.webp");
      expect(getCoverImageUrl({})).toBe("/images/fallback-cover.webp");
      expect(
        getCoverImageUrl({ coverImageUrl: "", coverImageId: "" }),
      ).toBe("/images/fallback-cover.webp");
    });
  });

  describe("getAbsoluteCoverImageUrl", () => {
    it("returns direct HTTPS URL unchanged", () => {
      const directUrl = "https://res.cloudinary.com/dx3ly69cz/image.webp";
      const res = getAbsoluteCoverImageUrl(
        { coverImageUrl: directUrl },
        "https://freshangle.vercel.app",
      );
      expect(res).toBe(directUrl);
    });

    it("prepends base site URL for relative paths", () => {
      const res = getAbsoluteCoverImageUrl(
        { coverImageId: "uuid-456" },
        "https://freshangle.vercel.app",
      );
      expect(res).toBe("https://freshangle.vercel.app/api/images/uuid-456");
    });
  });

  describe("cloudinaryLoader", () => {
    it("formats Cloudinary URL with responsive width, auto format, and auto quality", () => {
      const src =
        "https://res.cloudinary.com/test-cloud/image/upload/fresh-angle/covers/2026/11/sample-slug.webp";
      const optimized = cloudinaryLoader({ src, width: 896 });
      expect(optimized).toBe(
        "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,w_896,c_limit/fresh-angle/covers/2026/11/sample-slug.webp",
      );
    });

    it("leaves non-Cloudinary URLs unchanged", () => {
      const local = "/images/fallback-cover.webp";
      expect(cloudinaryLoader({ src: local, width: 640 })).toBe(local);
    });
  });

  describe("CloudinaryImageStorage Retry & Error Handling", () => {
    it("retries on 500 error with backoff and succeeds if subsequent attempt succeeds", async () => {
      const storage = new CloudinaryImageStorage();
      let callCount = 0;

      vi.spyOn(global, "fetch").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response("Internal Server Error", { status: 500 });
        }
        return new Response(
          JSON.stringify({
            secure_url: "https://res.cloudinary.com/test-cloud/image/upload/success.webp",
            public_id: "test-folder/covers/2026/11/test-image",
            bytes: 120000,
            width: 1200,
            height: 630,
            format: "webp",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const result = await storage.put(Buffer.from("dummy-webp"), {
        slug: "test-slug",
      });

      expect(callCount).toBe(2);
      expect(result.publicUrl).toContain("success.webp");
      expect(result.bytes).toBe(120000);
    });

    it("throws typed error after 3 consecutive failures", async () => {
      const storage = new CloudinaryImageStorage();
      let callCount = 0;

      vi.spyOn(global, "fetch").mockImplementation(async () => {
        callCount++;
        return new Response("Gateway Timeout", { status: 504 });
      });

      await expect(
        storage.put(Buffer.from("dummy-webp"), { slug: "test-slug" }),
      ).rejects.toThrow(/Cloudinary upload failed \(HTTP 504\)/);

      expect(callCount).toBe(3);
    });
  });
});

