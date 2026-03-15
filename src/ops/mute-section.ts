import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, MuteSectionOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function muteSection(input: VideoInput, options: MuteSectionOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      const audioFilters: string[] = [];
      
      options.sections.forEach(sec => {
          audioFilters.push(`volume=enable='between(t,${sec.start},${sec.end})':volume=0`);
      });
      
      if (audioFilters.length > 0) {
          cmd.audioFilters(audioFilters);
      }
      
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `muteSection failed: ${e.message}`);
  } finally {
    await cleanup();
  }
}
