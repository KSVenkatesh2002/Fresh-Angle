import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoverImage } from "@/services/images/cover";

vi.mock("@/services/images/cloudflare", () => ({
  generateCloudflareCover: vi.fn(),
}));

vi.mock("@/services/images/pollinations", () => ({
  generatePollinationsCover: vi.fn(),
}));

vi.mock("@/services/images/imagen", () => ({
  generateImagenCover: vi.fn(),
}));

vi.mock("@/services/images/pexels", () => ({
  searchPexelsImage: vi.fn(),
}));

vi.mock("@/services/images/process", () => ({
  processImageToWebp: vi.fn().mockImplementation(async (buf: Buffer) => buf),
  generateDefaultBrandedCover: vi.fn().mockImplementation(async () => Buffer.from("BRANDED_COVER")),
}));

vi.mock("@/services/usage/tracker", () => ({
  recordUsage: vi.fn().mockResolvedValue(undefined),
}));

import { generateCloudflareCover } from "@/services/images/cloudflare";
import { generatePollinationsCover } from "@/services/images/pollinations";
import { generateImagenCover } from "@/services/images/imagen";
import { searchPexelsImage } from "@/services/images/pexels";

describe("Resilient Multi-Provider Cover Image Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  const sampleInput = {
    prompt: "An intricate micro-photograph of a photonic quantum silicon die",
    keyword: "photonic quantum chip",
    title: "Optical Quantum Computing Breakthrough",
    category: "Hardware & Silicon",
    altText: "Photonic quantum processor silicon die with waveguide paths",
  };

  it("prioritizes Cloudflare flux-1-schnell when available", async () => {
    (generateCloudflareCover as any).mockResolvedValueOnce(Buffer.from("CLOUDFLARE_IMAGE"));

    const result = await getCoverImage(sampleInput);

    expect(result.source).toBe("ai");
    expect(result.buffer.toString()).toBe("CLOUDFLARE_IMAGE");
    expect(generateCloudflareCover).toHaveBeenCalledTimes(1);
    expect(generatePollinationsCover).not.toHaveBeenCalled();
  });

  it("falls back to Pollinations Flux-Dev if Cloudflare fails", async () => {
    (generateCloudflareCover as any).mockRejectedValueOnce(new Error("CF rate limited"));
    (generatePollinationsCover as any).mockResolvedValueOnce(Buffer.from("POLLINATIONS_IMAGE"));

    const result = await getCoverImage(sampleInput);

    expect(result.source).toBe("ai");
    expect(result.buffer.toString()).toBe("POLLINATIONS_IMAGE");
    expect(generatePollinationsCover).toHaveBeenCalledTimes(1);
    expect(generateImagenCover).not.toHaveBeenCalled();
  });

  it("falls back to Google Imagen 3 if Cloudflare and Pollinations fail", async () => {
    (generateCloudflareCover as any).mockRejectedValueOnce(new Error("CF timeout"));
    (generatePollinationsCover as any).mockRejectedValueOnce(new Error("Pollinations 503"));
    (generateImagenCover as any).mockResolvedValueOnce(Buffer.from("IMAGEN_IMAGE"));

    const result = await getCoverImage(sampleInput);

    expect(result.source).toBe("ai");
    expect(result.buffer.toString()).toBe("IMAGEN_IMAGE");
    expect(generateImagenCover).toHaveBeenCalledTimes(1);
    expect(searchPexelsImage).not.toHaveBeenCalled();
  });

  it("falls back to Pexels if all AI synthesis providers fail", async () => {
    (generateCloudflareCover as any).mockRejectedValueOnce(new Error("CF error"));
    (generatePollinationsCover as any).mockRejectedValueOnce(new Error("Pollinations error"));
    (generateImagenCover as any).mockRejectedValueOnce(new Error("Imagen error"));
    (searchPexelsImage as any).mockResolvedValueOnce({
      buffer: Buffer.from("PEXELS_IMAGE"),
      credit: "Photo by Jane Doe on Pexels",
    });

    const result = await getCoverImage(sampleInput);

    expect(result.source).toBe("pexels");
    expect(result.credit).toContain("Pexels");
    expect(result.buffer.toString()).toBe("PEXELS_IMAGE");
  });

  it("falls back to Default Branded Editorial vector if Pexels also fails", async () => {
    (generateCloudflareCover as any).mockRejectedValueOnce(new Error("CF error"));
    (generatePollinationsCover as any).mockRejectedValueOnce(new Error("Pollinations error"));
    (generateImagenCover as any).mockRejectedValueOnce(new Error("Imagen error"));
    (searchPexelsImage as any).mockRejectedValueOnce(new Error("Pexels 404"));

    const result = await getCoverImage(sampleInput);

    expect(result.source).toBe("default");
    expect(result.credit).toBe("Fresh Angle Editorial");
    expect(result.buffer.toString()).toBe("BRANDED_COVER");
  });
});

