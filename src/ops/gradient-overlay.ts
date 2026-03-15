import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, GradientOverlayOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { getMetadata } from './get-metadata.js';
import { ok, err } from '../utils/result.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import { gradientOverlay as gradientOverlayImage } from 'image-edit-tools';
import fs from 'node:fs/promises';

export async function gradientOverlay(input: VideoInput, options: GradientOverlayOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  let bgPath = '';

  try {
    const meta = await getMetadata(input);
    if (!meta.ok) throw new Error(meta.error);

    const w = meta.data.width || 1280;
    const h = meta.data.height || 720;

    // 1. Create a transparent PNG of the video's size
    bgPath = generateTmpFilePath('png');
    await new Promise<void>((resolve, reject) => {
        Ffmpeg()
            .input(`color=c=black@0:s=${w}x${h}`)
            .inputFormat('lavfi')
            .outputOptions(['-vframes 1'])
            .output(bgPath)
            .on('end', () => resolve())
            .on('error', (e) => reject(e))
            .run();
    });

    const transparentBuffer = await fs.readFile(bgPath);

    // 2. Apply image-edit-tools gradientOverlay
    const gradientResult = await gradientOverlayImage(transparentBuffer, {
        direction: options.direction,
        color: options.color,
        opacity: options.opacity,
        coverage: options.coverage
    });

    if (!gradientResult.ok) {
        throw new Error(gradientResult.error);
    }

    const gradientPath = generateTmpFilePath('png');
    await fs.writeFile(gradientPath, gradientResult.data);

    // 3. Composite over video
    const buffer = await withOutput('mp4', () => {
        const cmd = Ffmpeg(inputPath);
        cmd.input(gradientPath);
        cmd.complexFilter([
            '[0:v][1:v]overlay=0:0[outv]'
        ], ['outv']);
        return cmd;
    });

    await cleanupTmpFile(gradientPath);

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `gradientOverlay failed: ${e.message}`);
  } finally {
    await cleanup();
    if (bgPath) await cleanupTmpFile(bgPath);
  }
}
