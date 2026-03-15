import { env, pipeline } from '@xenova/transformers';
import { VideoInput, TranscribeOptions, TranscribeResult, Result, ErrorCode } from '../types.js';
import { extractAudio } from './extract-audio.js';
import { ok, err } from '../utils/result.js';
import fs from 'node:fs/promises';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';

// Configure transformers not to use local proxy or cache if we don't want to,
// but default caching is fine for models
env.allowLocalModels = false;
env.useBrowserCache = false; 

let whisperPipeline: any = null;
let isFirstRun = true;

function formatTimestamp(seconds: number, format: 'srt' | 'vtt'): string {
    const d = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
    const sep = format === 'srt' ? ',' : '.';
    return format === 'srt' ? `${hh}:${mm}:${ss}${sep}${ms}` : `${hh}:${mm}:${ss}${sep}${ms}`;
}

export async function transcribe(input: VideoInput, options?: TranscribeOptions): Promise<Result<TranscribeResult>> {
  const warnings: string[] = [];
  
  if (isFirstRun) {
      warnings.push("Downloading Whisper model on first run (~150MB)...");
      isFirstRun = false;
  }

  const modelSize = options?.model || 'base';
  
  try {
    // 1. Extract audio to WAV for Whisper
    const audioRes = await extractAudio(input, { format: 'wav' });
    if (!audioRes.ok) return err(audioRes.code, audioRes.error);

    const tmpWavPath = generateTmpFilePath('wav');
    await fs.writeFile(tmpWavPath, audioRes.data);

    // 2. Load model
    if (!whisperPipeline) {
        whisperPipeline = await pipeline('automatic-speech-recognition', `Xenova/whisper-${modelSize}`);
    }

    // xenova whisper accepts Float32Array or file paths
    const output = await whisperPipeline(tmpWavPath, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: options?.language,
        task: 'transcribe',
        return_timestamps: true
    });

    const segments = output.chunks || [];
    const text = output.text;

    let srt = '';
    let vtt = '';

    if (options?.format === 'srt' || options?.format === 'vtt') {
        if (options.format === 'vtt') vtt += "WEBVTT\n\n";

        segments.forEach((chunk: any, i: number) => {
            const start = chunk.timestamp[0];
            const end = chunk.timestamp[1] || start + 2; // naive fallback if last chunk misses end
            const chunkText = chunk.text.trim();

            if (options.format === 'srt') {
                srt += `${i + 1}\n`;
                srt += `${formatTimestamp(start, 'srt')} --> ${formatTimestamp(end, 'srt')}\n`;
                srt += `${chunkText}\n\n`;
            } else if (options.format === 'vtt') {
                vtt += `${formatTimestamp(start, 'vtt')} --> ${formatTimestamp(end, 'vtt')}\n`;
                vtt += `${chunkText}\n\n`;
            }
        });
    }

    await cleanupTmpFile(tmpWavPath);

    return ok({
        text,
        segments: segments.map((c: any) => ({
            start: c.timestamp[0],
            end: c.timestamp[1] || c.timestamp[0] + 2,
            text: c.text.trim()
        })),
        ...(options?.format === 'srt' ? { srt } : {}),
        ...(options?.format === 'vtt' ? { vtt } : {})
    }, warnings);

  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `transcribe failed: ${e.message}`);
  }
}
