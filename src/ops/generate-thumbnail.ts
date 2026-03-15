import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, GenerateThumbnailOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import { ok, err } from '../utils/result.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export async function generateThumbnail(input: VideoInput, options?: GenerateThumbnailOptions): Promise<Result<Buffer | Buffer[]>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  const outDir = path.join(os.tmpdir(), `vet-thumb-${crypto.randomUUID()}`);
  await fs.mkdir(outDir, { recursive: true });

  const format = options?.format || 'jpeg';
  const width = options?.width ? `${options.width}` : '?';
  const height = options?.height ? `${options.height}` : '?';

  try {
    await new Promise<void>((resolve, reject) => {
        const cmd = Ffmpeg(inputPath);
        
        const count = options?.count || 1;
        
        if (options?.time !== undefined) {
             cmd.setStartTime(options.time);
             cmd.outputOptions(['-vframes 1']);
        } else if (count === 1) {
             // select brightest or most detailed frame? we can just pick halfway or generic vframes
             // standard approach: just pick 00:00:01 if possible or let ffmpeg pick
             cmd.outputOptions(['-vframes 1']);
             // Alternatively, thumbnail filter:
             // cmd.videoFilters([`thumbnail,scale=${width}:${height}`]);
        } else {
             // Count > 1, extract evenly
             // The prompt has extractFrames for this, but generating multiples thumbnails is requested here too.
             cmd.outputOptions([`-vframes ${count}`]);
        }

        if (width !== '?' || height !== '?') {
            cmd.size(`${width}x${height}`);
        }

        const ext = format === 'jpeg' ? 'jpg' : format;
        cmd.output(path.join(outDir, `thumb-%04d.${ext}`))
           .on('end', () => resolve())
           .on('error', (e) => reject(e))
           .run();
    });

    const files = await fs.readdir(outDir);
    files.sort();
    
    const buffers: Buffer[] = [];
    for (const file of files) {
        if (!file.startsWith('.')) {
            buffers.push(await fs.readFile(path.join(outDir, file)));
        }
    }
    
    if (buffers.length === 0) {
        throw new Error('No thumbnails generated');
    }

    if (options?.count && options.count > 1) {
        return ok(buffers);
    }
    
    return ok(buffers[0]);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `generateThumbnail failed: ${e.message}`);
  } finally {
    await cleanup();
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
