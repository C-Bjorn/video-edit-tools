import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, AdjustVolumeOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { getMetadata } from './get-metadata.js';
import { ok, err } from '../utils/result.js';

export async function adjustVolume(input: VideoInput, options: AdjustVolumeOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    let duration = 0;
    if (options.fadeOut) {
        const meta = await getMetadata(input);
        if (meta.ok) duration = meta.data.duration;
    }

    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      const audioFilters: string[] = [];
      
      if (options.volume !== undefined) {
          audioFilters.push(`volume=${options.volume}`);
      }
      
      if (options.normalize) {
          audioFilters.push('loudnorm');
      }
      
      if (options.fadeIn) {
          audioFilters.push(`afade=t=in:st=0:d=${options.fadeIn}`);
      }
      
      if (options.fadeOut && duration > 0) {
          const startOut = Math.max(0, duration - options.fadeOut);
          audioFilters.push(`afade=t=out:st=${startOut}:d=${options.fadeOut}`);
      }
      
      if (audioFilters.length > 0) {
          cmd.audioFilters(audioFilters);
      }
      
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `adjustVolume failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
