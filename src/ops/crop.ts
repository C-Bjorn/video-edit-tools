import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, CropOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function crop(input: VideoInput, options: CropOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      if (options.aspectRatio) {
          // Crop to match aspect ratio, keeping center
          // Assuming format like '16:9'
          const ratio = options.aspectRatio.replace(':', '/');
          cmd.videoFilters([`crop=iw:iw/(${ratio})`]);
      } else {
          const w = options.width || 'iw';
          const h = options.height || 'ih';
          const x = options.x !== undefined ? options.x : '(in_w-out_w)/2';
          const y = options.y !== undefined ? options.y : '(in_h-out_h)/2';
          cmd.videoFilters([`crop=${w}:${h}:${x}:${y}`]);
      }
      return cmd;
    });
    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `Crop failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
