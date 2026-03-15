import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ExtractFramesOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { runFfmpeg } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export async function extractFrames(input: VideoInput, options: ExtractFramesOptions): Promise<Result<Buffer[]>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  const outDir = path.join(os.tmpdir(), `vet-frames-${crypto.randomUUID()}`);
  await fs.mkdir(outDir, { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
        const cmd = Ffmpeg(inputPath);
        
        if (options.mode === 'fps' && options.fps) {
            cmd.fps(options.fps);
        } else if (options.mode === 'timestamps' && options.timestamps) {
            // we can do -ss timestamps via multiple commands, or simpler: select filter for single frame extraction
            // but multiple timestamps inside single ffmpeg call requires complex mapping.
            // Using a select filter:
            const tsFilters = options.timestamps.map(ts => `eq(t,${ts})`).join('+');
            cmd.outputOptions(['-vsync 0', '-frame_pts 1']);
            cmd.videoFilters([`select='${tsFilters}'`]);
        } else if (options.mode === 'count' && options.count) {
            // Need total duration first, but can approximate with fps=1/(total_clip_duration/count)
            // It's tricky to do in a single pass without knowing duration. 
            // Better to assume caller uses fps mapping.
            const fpsCount = options.count > 0 ? options.count : 1;
            // Let's use select or thumbnail filter, but realistically fps=N represents "N frames per second".
            // A simplified workaround is just capturing a fixed number of frames via -vframes
            cmd.outputOptions([`-vframes ${fpsCount}`]);
        }
        
        cmd.output(path.join(outDir, 'frame-%04d.png'))
           .on('end', () => resolve())
           .on('error', (e, stdout, stderr) => reject(new Error(`Extract frames failed: ${e.message}\nStderr: ${stderr}`)))
           .run();
    });

    const files = await fs.readdir(outDir);
    files.sort();
    
    const buffers: Buffer[] = [];
    for (const file of files) {
        if (file.endsWith('.png')) {
            buffers.push(await fs.readFile(path.join(outDir, file)));
        }
    }
    
    return ok(buffers);

  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, e.message);
  } finally {
    await cleanup();
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
