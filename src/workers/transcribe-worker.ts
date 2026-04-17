/**
 * Worker thread entry point for video_transcribe.
 *
 * Runs @xenova/transformers Whisper inference in an isolated V8 context so the
 * main Node.js event loop stays free to serve video_get_job_status and all
 * other MCP tool calls during long transcription jobs.
 *
 * Protocol:
 *   workerData  → { input: VideoInput, opts: TranscribeOptions & { output: string } }
 *   postMessage → { ok: true,  savedTo: string }
 *              OR { ok: false, error: string }
 */
import { workerData, parentPort } from 'node:worker_threads';
import { transcribe } from '../ops/transcribe.js';
import type { TranscribeOptions } from '../types.js';
import type { VideoInput } from '../types.js';

const { input, opts } = workerData as {
    input: VideoInput;
    opts: TranscribeOptions & { output: string };
};

transcribe(input, opts)
    .then(res => {
        if (res.ok) {
            parentPort!.postMessage({ ok: true, savedTo: res.data.savedTo ?? opts.output });
        } else {
            parentPort!.postMessage({ ok: false, error: (res as any).error ?? 'transcribe failed' });
        }
    })
    .catch((e: any) => {
        parentPort!.postMessage({ ok: false, error: e?.message ?? String(e) });
    });
