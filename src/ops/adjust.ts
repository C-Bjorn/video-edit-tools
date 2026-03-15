import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, AdjustOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function adjust(input: VideoInput, options: AdjustOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      const eqOpts: string[] = [];
      if (options.brightness !== undefined) {
         // UI -100 to 100 -> ffmpeg -1.0 to 1.0
         eqOpts.push(`brightness=${options.brightness / 100}`);
      }
      if (options.contrast !== undefined) {
         // UI -100 to 100 -> ffmpeg 0.0 to 2.0 (default 1.0)
         eqOpts.push(`contrast=${(options.contrast + 100) / 100}`);
      }
      if (options.saturation !== undefined) {
         // UI -100 to 100 -> ffmpeg 0.0 to 3.0 (approx, mapping to 0 to 2.0)
         eqOpts.push(`saturation=${(options.saturation + 100) / 100}`);
      }
      if (options.gamma !== undefined) {
         eqOpts.push(`gamma=${options.gamma}`);
      }
      if (options.hue !== undefined) {
         eqOpts.push(`h=${options.hue}`); // normally 'h' for degrees in some versions, or 'h' is radians? ffmpeg h defaults to degrees
      }
      
      if (eqOpts.length > 0) {
          cmd.videoFilters([`eq=${eqOpts.join(':')}`]);
      }
      
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `adjust failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
