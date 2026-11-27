import { getDb } from "@/db/client";
import { automationSettings } from "@/db/schema";

/**
 * Determines whether a pipeline-generated post should auto-publish at run time.
 * Precedence:
 * 1. Test runs always stay draft (false).
 * 2. Database `automation_settings.publish_mode` wins over environment variables
 *    ("auto" => true, anything else => false).
 * 3. If no DB row/value exists, falls back to `process.env.AUTO_PUBLISH === "true"`.
 * 4. On any DB error, safely defaults to draft (false).
 */
export async function resolveAutoPublish(
  options: { isTest?: boolean } = {},
): Promise<boolean> {
  if (options.isTest) {
    return false;
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ publishMode: automationSettings.publishMode })
      .from(automationSettings)
      .limit(1);

    const row = rows[0];
    if (row && row.publishMode) {
      return row.publishMode === "auto";
    }

    return process.env.AUTO_PUBLISH === "true";
  } catch (err) {
    console.warn(
      `⚠️ [AutoPublish] Could not read automation_settings.publish_mode, defaulting to draft: ${(err as Error).message}`,
    );
    return false;
  }
}

