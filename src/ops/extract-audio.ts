import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ExtractAudioOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function extractAudio(input: VideoInput, options?: ExtractAudioOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  const format = options?.format || 'mp3';

  try {
    const buffer = await withOutput(format, () => {
      const cmd = Ffmpeg(inputPath).noVideo();

      if (options?.quality) {
          // Adjust audio bitrate based on quality (0-100)
          const kbit = Math.max(32, Math.min(320, Math.round(options.quality * 3.2)));
          cmd.audioBitrate(`${kbit}k`);
      }

      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `extractAudio failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
