import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { postLinks } from "@/db/schema";
import { ValidatedLink } from "./link-processor";

export async function savePostLinks(
  fromPostId: string,
  links: ValidatedLink[],
  type: "auto" | "manual" = "auto",
): Promise<void> {
  if (links.length === 0) return;
  const db = getDb();

  try {
    // Delete prior links of this type for the post
    await db
      .delete(postLinks)
      .where(
        and(eq(postLinks.fromPostId, fromPostId), eq(postLinks.type, type)),
      );

    // Insert updated links
    await db.insert(postLinks).values(
      links.map((link) => ({
        fromPostId,
        toPostId: link.targetPostId,
        anchor: link.anchor,
        type,
      })),
    );
  } catch (err) {
    console.warn(
      `⚠️ [LinkGraph] Failed to record post links: ${(err as Error).message}`,
    );
  }
}
