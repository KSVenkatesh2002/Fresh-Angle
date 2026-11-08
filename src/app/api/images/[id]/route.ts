import { NextRequest, NextResponse } from "next/server";
import { getLegacyDbImage } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  if (!id) {
    return new NextResponse("Image ID required", { status: 400 });
  }

  try {
    const imageRecord = await getLegacyDbImage(id);

    if (!imageRecord) {
      return new NextResponse("Image not found", { status: 404 });
    }

    // 1. If migrated to Cloudinary, return 301 Permanent Redirect
    if (imageRecord.publicUrl) {
      return NextResponse.redirect(imageRecord.publicUrl, {
        status: 301,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. Legacy fallback for unmigrated rows
    if (imageRecord.data) {
      return new Response(new Uint8Array(imageRecord.data), {
        status: 200,
        headers: {
          "Content-Type": imageRecord.mime || "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": imageRecord.data.length.toString(),
        },
      });
    }

    return new NextResponse("Image data not available", { status: 404 });
  } catch (error) {
    console.error(`Error serving image ${id}:`, error);
    return new NextResponse("Internal image delivery error", { status: 500 });
  }
}
