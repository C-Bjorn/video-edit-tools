import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ApplyFilterOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function applyFilter(input: VideoInput, options: ApplyFilterOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      let filter = '';
      
      const intensity = options.intensity !== undefined ? options.intensity : 50;

      switch (options.filter) {
          case 'grayscale':
              filter = 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3';
              break;
          case 'sepia':
              filter = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
              break;
          case 'vintage':
              filter = 'curves=vintage';
              break;
          case 'blur':
              const b = Math.max(1, Math.round(intensity / 5));
              filter = `boxblur=${b}:1`;
              break;
          case 'sharpen':
              // unsharp luma_msize_x:luma_msize_y:luma_amount
              const amt = intensity / 25; // 0 to 4.0
              filter = `unsharp=5:5:${amt}:5:5:0.0`;
              break;
          case 'vignette':
              filter = `vignette=PI/4`;
              break;
          default:
              filter = '';
      }
      
      if (filter) {
          cmd.videoFilters([filter]);
      }
      
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `applyFilter failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
