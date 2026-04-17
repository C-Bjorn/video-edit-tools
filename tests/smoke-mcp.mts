/**
 * Smoke test for MCP handleTool fixes:
 * 1. video_resize — was throwing "ops.generateTmpFilePath is not a function"
 * 2. video_pipeline — was throwing "steps is not iterable"
 *    Also tests 'operation' key normalization (Claude Desktop sends 'operation' not 'op')
 * 3. output parameter — all affected tools accept an optional output path
 *
 * Day02.01: video_resize, video_trim are now async (fire-and-forget).
 * They return { job_id, status: 'processing' } immediately.
 * Use pollJob() to await completion via video_get_job_status.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { handleTool } from '../src/mcp/tools.js';

const SAMPLE = path.join(process.cwd(), 'tests', 'fixtures', 'sample.mp4');
const TMP = os.tmpdir();

async function test(label: string, fn: () => Promise<void>) {
    process.stdout.write(`  ${label} ... `);
    try {
        await fn();
        console.log('✅ PASS');
    } catch (e: any) {
        console.log(`❌ FAIL: ${e.message}`);
        process.exitCode = 1;
    }
}

/**
 * Poll video_get_job_status until status is 'done' or 'error', or until timeout.
 * Returns savedTo path on success, throws on error or timeout.
 */
async function pollJob(jobId: string, timeoutMs = 30_000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const res = await handleTool('video_get_job_status', { job_id: jobId });
        const record = JSON.parse(res.content[0].text);
        if (record.status === 'done') return record.savedTo as string;
        if (record.status === 'error') throw new Error(`Job failed: ${record.error}`);
        if (record.status === 'not_found') throw new Error(`Job ${jobId} not found`);
        // Still processing — wait 500ms and retry
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

async function run() {
    console.log('\n=== MCP handleTool smoke tests ===\n');

    // ── video_get_job_status — unknown job ─────────────────────────────────────
    await test('video_get_job_status with unknown job_id returns not_found', async () => {
        const res = await handleTool('video_get_job_status', { job_id: '00000000-0000-0000-0000-000000000000' });
        const payload = JSON.parse(res.content[0].text);
        if (payload.status !== 'not_found') throw new Error(`Expected not_found, got ${payload.status}`);
    });

    // ── Bug 1: video_resize — async (Day02.01) ─────────────────────────────────
    await test('video_resize (async → poll until done)', async () => {
        const res = await handleTool('video_resize', { input: SAMPLE, width: 640, height: 360, fit: 'fill' });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.job_id) throw new Error('Expected job_id in response');
        if (payload.status !== 'processing') throw new Error(`Expected processing, got ${payload.status}`);
        const savedTo = await pollJob(payload.job_id);
        await fs.access(savedTo);
        await fs.unlink(savedTo).catch(() => {});
    });

    // ── Bug 2: video_pipeline — steps extraction & op normalization (sync) ─────
    await test("video_pipeline steps with 'op' key", async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'resize', width: 320, height: 180, fit: 'fill' }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    await test("video_pipeline steps with 'operation' key (Claude compat)", async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ operation: 'resize', width: 320, height: 180, fit: 'fill' }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    await test('video_pipeline steps as JSON string', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: JSON.stringify([{ op: 'resize', width: 320, height: 180, fit: 'fill' }])
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    await test('video_pipeline with concat step', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'concat', inputs: [SAMPLE] }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // ── output parameter (async tools) ─────────────────────────────────────────
    const outFile = path.join(TMP, `smoke-resize-output-${Date.now()}.mp4`);
    await test('video_resize with explicit output path (async → poll)', async () => {
        const res = await handleTool('video_resize', {
            input: SAMPLE, width: 320, height: 180, fit: 'fill',
            output: outFile
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.job_id) throw new Error('Expected job_id in response');
        const savedTo = await pollJob(payload.job_id);
        if (savedTo !== outFile) throw new Error(`savedTo mismatch: ${savedTo}`);
        await fs.access(outFile);
        await fs.unlink(outFile).catch(() => {});
    });

    // ── output parameter (sync pipeline) ───────────────────────────────────────
    const pipelineOut = path.join(TMP, `smoke-pipeline-output-${Date.now()}.mp4`);
    await test('video_pipeline with output path (sync)', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'resize', width: 320, height: 180, fit: 'fill' }],
            output: pipelineOut
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (payload.data.savedTo !== pipelineOut) throw new Error(`savedTo mismatch: ${payload.data.savedTo}`);
        await fs.access(pipelineOut);
        await fs.unlink(pipelineOut).catch(() => {});
    });

    // ── auto-mkdir for async trim ───────────────────────────────────────────────
    const nestedOut = path.join(TMP, `smoke-nested-${Date.now()}`, 'subdir', 'output.mp4');
    await test('video_trim with output in non-existent directory (auto-mkdir, async → poll)', async () => {
        const res = await handleTool('video_trim', {
            input: SAMPLE, start: '0', end: '2',
            output: nestedOut
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.job_id) throw new Error('Expected job_id in response');
        const savedTo = await pollJob(payload.job_id);
        if (savedTo !== nestedOut) throw new Error(`savedTo mismatch: ${savedTo}`);
        await fs.access(nestedOut);
        await fs.rm(path.dirname(path.dirname(nestedOut)), { recursive: true }).catch(() => {});
    });

    console.log('\n');
}

run().catch(e => { console.error(e); process.exit(1); });
