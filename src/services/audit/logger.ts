import { getDb } from "@/db/client";
import { auditLog, NewAuditLogEntry } from "@/db/schema";

export interface LogAuditParams {
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAuditLog(params: LogAuditParams): Promise<void> {
  try {
    const db = getDb();
    const entry: NewAuditLogEntry = {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? "admin",
      createdAt: new Date(),
    };

    await db.insert(auditLog).values(entry);
  } catch (err) {
    console.warn(
      `⚠️ [AuditLogger] Failed to write audit record: ${(err as Error).message}`,
    );
  }
}
