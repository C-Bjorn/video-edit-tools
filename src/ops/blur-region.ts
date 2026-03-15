import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, BlurRegionOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function blurRegion(input: VideoInput, options: BlurRegionOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      const filterGraph: string[] = [];
      let latestOutput = '0:v';

      options.regions.forEach((region, index) => {
          const blurAmount = options.blur || 15;
          const w = region.width;
          const h = region.height;
          const x = region.x;
          const y = region.y;

          const currentIn = latestOutput;
          const cropped = `[crop${index}]`;
          const blurred = `[blur${index}]`;
          const merged = `[out${index}]`;

          filterGraph.push(
              `${currentIn}split=2[base${index}][temp${index}]`,
              `[temp${index}]crop=${w}:${h}:${x}:${y}${cropped}`,
              `${cropped}boxblur=${blurAmount}:1${blurred}`,
              `[base${index}]${blurred}overlay=${x}:${y}${merged}`
          );
          
          latestOutput = merged;
      });

      if (filterGraph.length > 0) {
          cmd.complexFilter(filterGraph, latestOutput.replace(/\[|\]/g, ''));
      }
      
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `blurRegion failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
