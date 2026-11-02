import { createPipelineRun, updatePipelineRun } from '@/db/queries/runs';
import { PipelineStepRecord } from '@/db/schema';
import { sendPipelineFailureNotification } from '@/services/notify/telegram';
import { stepPickTopic } from './steps/pick-topic';
import { stepResearch } from './steps/research';
import { stepOutline } from './steps/outline';
import { stepDraft } from './steps/draft';
import { stepReview } from './steps/review';
import { stepCover } from './steps/cover';
import { stepSave } from './steps/save';
import { stepPublishAndNotify } from './steps/publish';

export async function runDailyPipeline(): Promise<string> {
  console.log('\n======================================================');
  console.log('🚀 [Fresh Angle] Initiating Autonomous Publishing Pipeline');
  console.log('======================================================\n');

  const stepsRecord: PipelineStepRecord[] = [
    { step: 'pick_topic', status: 'pending', durationMs: 0 },
    { step: 'research', status: 'pending', durationMs: 0 },
    { step: 'outline', status: 'pending', durationMs: 0 },
    { step: 'draft', status: 'pending', durationMs: 0 },
    { step: 'review', status: 'pending', durationMs: 0 },
    { step: 'cover_image', status: 'pending', durationMs: 0 },
    { step: 'save', status: 'pending', durationMs: 0 },
    { step: 'publish_notify', status: 'pending', durationMs: 0 },
  ];

  let runId: string | null = null;
  let activeStepName = 'initialization';

  try {
    const initialRun = await createPipelineRun({
      status: 'partial',
      steps: stepsRecord,
    });
    runId = initialRun.id;
  } catch (dbErr) {
    console.warn(`⚠️ Could not create initial pipeline_run record in DB: ${(dbErr as Error).message}`);
  }

  const recordStepTiming = (stepName: string, durationMs: number, success: boolean, details?: string) => {
    const item = stepsRecord.find((s) => s.step === stepName);
    if (item) {
      item.status = success ? 'success' : 'failed';
      item.durationMs = durationMs;
      item.details = details;
    }
  };

  try {
    // 1. Pick Topic
    activeStepName = 'pick_topic';
    let start = Date.now();
    const { topic } = await stepPickTopic();
    recordStepTiming('pick_topic', Date.now() - start, true, topic.title);

    // 2. Research
    activeStepName = 'research';
    start = Date.now();
    const researchResult = await stepResearch(topic);
    recordStepTiming(
      'research',
      Date.now() - start,
      true,
      `${researchResult.sources.length} sources analyzed`
    );

    // 3. Outline (AI Call 1)
    activeStepName = 'outline';
    start = Date.now();
    const outlineResult = await stepOutline(topic.title, researchResult.formattedSourcesText);
    recordStepTiming('outline', Date.now() - start, true, `Provider: ${outlineResult.provider}`);

    // 4. Draft (AI Call 2)
    activeStepName = 'draft';
    start = Date.now();
    const draftResult = await stepDraft(
      topic.title,
      outlineResult.outline,
      researchResult.formattedSourcesText
    );
    recordStepTiming('draft', Date.now() - start, true, `Provider: ${draftResult.provider}`);

    // 5. Review (AI Call 3)
    activeStepName = 'review';
    start = Date.now();
    const reviewResult = await stepReview(
      topic.title,
      draftResult.draftMarkdown,
      researchResult.formattedSourcesText
    );
    recordStepTiming('review', Date.now() - start, true, `Slug: ${reviewResult.post.slug}`);

    // 6. Cover Image
    activeStepName = 'cover_image';
    start = Date.now();
    const coverResult = await stepCover(reviewResult.post);
    recordStepTiming('cover_image', Date.now() - start, true, `Source: ${coverResult.source}`);

    // 7. Save to DB
    activeStepName = 'save';
    start = Date.now();
    const autoPublish = process.env.AUTO_PUBLISH !== 'false';
    const savedPost = await stepSave({
      post: reviewResult.post,
      cover: coverResult,
      sources: researchResult.sources,
      aiProvider: reviewResult.provider,
      aiModel: reviewResult.model,
      autoPublish,
    });
    recordStepTiming('save', Date.now() - start, true, `Post ID: ${savedPost.id}`);

    // 8. Publish & Notify
    activeStepName = 'publish_notify';
    start = Date.now();
    await stepPublishAndNotify({
      post: savedPost,
      categoryName: reviewResult.post.category,
      provider: reviewResult.provider,
      model: reviewResult.model,
    });
    recordStepTiming('publish_notify', Date.now() - start, true);

    // Finalize DB Run record
    if (runId) {
      await updatePipelineRun(runId, {
        finishedAt: new Date(),
        status: 'success',
        steps: stepsRecord,
        providerUsed: reviewResult.provider,
        postId: savedPost.id,
      });
    }

    console.log('\n======================================================');
    console.log(`✅ Pipeline executed successfully! Published: "${savedPost.title}"`);
    console.log('======================================================\n');

    return savedPost.id;
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || 'Unknown pipeline failure';
    console.error(`\n❌ [Pipeline Failure] Aborted at step "${activeStepName}": ${errorMsg}`);

    recordStepTiming(activeStepName, 0, false, errorMsg);

    if (runId) {
      await updatePipelineRun(runId, {
        finishedAt: new Date(),
        status: 'failed',
        steps: stepsRecord,
        error: errorMsg,
      }).catch(() => {});
    }

    // Send Telegram failure alert
    await sendPipelineFailureNotification(errorMsg, activeStepName);

    throw err;
  }
}
