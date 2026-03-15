import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ChangeSpeedOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function changeSpeed(input: VideoInput, options: ChangeSpeedOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      const speed = Math.max(0.25, Math.min(100.0, options.speed));
      const setpts = `setpts=${1/speed}*PTS`;
      
      // For audio speed (atempo), limits are 0.5 to 2.0. We may need to chain them.
      let atempoFilters = '';
      let remainingSpeed = speed;
      
      while (remainingSpeed > 2.0) {
          atempoFilters += 'atempo=2.0,';
          remainingSpeed /= 2.0;
      }
      while (remainingSpeed < 0.5) {
          atempoFilters += 'atempo=0.5,';
          remainingSpeed /= 0.5;
      }
      atempoFilters += `atempo=${remainingSpeed}`;
      
      cmd.complexFilter([
          `[0:v]${setpts}[v]`,
          `[0:a]${atempoFilters}[a]`
      ], ['v', 'a']);
      
      return cmd;
    });
    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `Change speed failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
