import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ResizeOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function resize(input: VideoInput, options: ResizeOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      const w = options.width;
      const h = options.height;

      if (!w && !h) {
          throw new Error('Resize requires at least width or height');
      }

      if (options.fit === 'contain' && w && h) {
         cmd.size(`${w}x${h}`).autopad();
      } else if (options.fit === 'cover' && w && h) {
         cmd.videoFilters([
           `scale=${w}:${h}:force_original_aspect_ratio=increase`,
           `crop=${w}:${h}`
         ]);
      } else {
         if (w && h) {
             cmd.size(`${w}x${h}`);
         } else {
             const widthFilter = w ? `${w}` : '-2'; // -2 preserves aspect ratio while keeping width/height even
             const heightFilter = h ? `${h}` : '-2';
             cmd.videoFilters([`scale=${widthFilter}:${heightFilter}`]);
         }
      }
      return cmd;
    });
    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `Resize failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
