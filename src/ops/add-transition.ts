import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, AddTransitionOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';
import { getMetadata } from './get-metadata.js';

export async function addTransition(inputs: [VideoInput, VideoInput], options: AddTransitionOptions): Promise<Result<Buffer>> {
  if (!inputs || inputs.length !== 2) {
      return err(ErrorCode.INVALID_INPUT, 'addTransition requires exactly two inputs');
  }

  const duration = options.duration || 0.5;

  const [meta1, meta2] = await Promise.all([getMetadata(inputs[0]), getMetadata(inputs[1])]);
  if (!meta1.ok) return err(meta1.code, meta1.error);
  if (!meta2.ok) return err(meta2.code, meta2.error);

  const duration1 = meta1.data.duration;
  // Offset where transition starts
  const offset = duration1 - duration;
  if (offset <= 0) {
      return err(ErrorCode.INVALID_INPUT, 'First video is shorter than transition duration');
  }

  const loaded1 = await loadVideo(inputs[0]);
  if (!loaded1.ok) return loaded1;
  const loaded2 = await loadVideo(inputs[1]);
  if (!loaded2.ok) {
     await loaded1.data.cleanup();
     return loaded2;
  }

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg()
          .input(loaded1.data.path)
          .input(loaded2.data.path);
      
      let xfadeType = 'fade';
      switch (options.type) {
          case 'slide-left': xfadeType = 'slideleft'; break;
          case 'slide-right': xfadeType = 'slideright'; break;
          case 'wipe': xfadeType = 'wipeleft'; break;
          case 'dissolve': xfadeType = 'fade'; break;
          default: xfadeType = 'fade';
      }

      // Xfade requires same resolution and frame rate base
      const filterGraph = [
          '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]',
          '[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v1]',
          `[v0][v1]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[vout]`,
          // Audio crossfade across streams
          `[0:a][1:a]acrossfade=d=${duration}[aout]`
      ];

      cmd.complexFilter(filterGraph, ['vout', 'aout']);
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `addTransition failed: ${e.message}`);
  } finally {
    await loaded1.data.cleanup();
    await loaded2.data.cleanup();
  }
}
