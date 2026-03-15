import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, TrimOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function trim(input: VideoInput, options: TrimOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;

  const { path: inputPath, cleanup } = loaded.data;

  // Helper to parse TimeCode string into seconds
  const parseTime = (tc: number | string): number => {
      if (typeof tc === 'number') return tc;
      if (!tc.includes(':')) return parseFloat(tc);
      const parts = tc.split(':').reverse();
      let secs = 0;
      if (parts[0]) secs += parseFloat(parts[0]);
      if (parts[1]) secs += parseInt(parts[1], 10) * 60;
      if (parts[2]) secs += parseInt(parts[2], 10) * 3600;
      return secs;
  };

  try {
    const buffer = await withOutput('mp4', (outputPath) => {
      const startSec = parseTime(options.start);
      const cmd = Ffmpeg(inputPath).setStartTime(startSec);
      if (options.duration !== undefined) {
        cmd.setDuration(options.duration);
      } else if (options.end !== undefined) {
        const endSec = parseTime(options.end);
        cmd.setDuration(Math.max(0, endSec - startSec));
      }
      return cmd;
    });
    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `Trim failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
