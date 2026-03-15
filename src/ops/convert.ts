import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ConvertOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function convert(input: VideoInput, options: ConvertOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput(options.format, () => {
      const cmd = Ffmpeg(inputPath);
      
      if (options.fps) {
          cmd.fps(options.fps);
      }
      
      if (options.width) {
          cmd.size(`${options.width}x?`);
      }
      
      if (options.quality !== undefined) {
          // General quality mapping to ffmpeg options. Wait, for video, crf is common for mp4/webm.
          // lower crf = higher quality. Let's map 0-100 to 51-0
          const crf = Math.max(0, Math.min(51, Math.round(51 - (options.quality * 51 / 100))));
          cmd.outputOptions([`-crf ${crf}`]);
      }
      
      return cmd;
    });
    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `Convert failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
