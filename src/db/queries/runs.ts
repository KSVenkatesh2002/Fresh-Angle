import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { pipelineRuns, PipelineRun, NewPipelineRun } from '@/db/schema';

export async function getRecentRuns(limit: number = 20): Promise<PipelineRun[]> {
  const db = getDb();
  return db.query.pipelineRuns.findMany({
    orderBy: [desc(pipelineRuns.startedAt)],
    limit,
    with: {
      post: true,
    },
  });
}

export async function createPipelineRun(
  data: Omit<NewPipelineRun, 'id' | 'startedAt'>
): Promise<PipelineRun> {
  const db = getDb();
  const [created] = await db.insert(pipelineRuns).values(data).returning();
  return created;
}

export async function updatePipelineRun(
  id: string,
  data: Partial<Omit<NewPipelineRun, 'id' | 'startedAt'>>
): Promise<PipelineRun> {
  const db = getDb();
  const [updated] = await db
    .update(pipelineRuns)
    .set(data)
    .where(eq(pipelineRuns.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Pipeline run with id ${id} not found`);
  }

  return updated;
}
