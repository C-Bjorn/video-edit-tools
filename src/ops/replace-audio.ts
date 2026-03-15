import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ReplaceAudioOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';
import { getMetadata } from './get-metadata.js';

export async function replaceAudio(input: VideoInput, options: ReplaceAudioOptions): Promise<Result<Buffer>> {
  const meta = await getMetadata(input);
  if (!meta.ok) return err(meta.code, meta.error);
  const duration = meta.data.duration;

  const loadedVideo = await loadVideo(input);
  if (!loadedVideo.ok) return loadedVideo;

  const loadedAudio = await loadVideo(options.audio, 'mp3'); // can be any audio
  if (!loadedAudio.ok) {
     await loadedVideo.data.cleanup();
     return loadedAudio;
  }

  const { path: inputVideoPath, cleanup: cleanupVideo } = loadedVideo.data;
  const { path: inputAudioPath, cleanup: cleanupAudio } = loadedAudio.data;

  try {
    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg()
          .input(inputVideoPath)
          .input(inputAudioPath);
          
      if (options.loop) {
          cmd.inputOptions(['-stream_loop -1']);
      }

      const filters: any[] = [];
      let currentA = '1:a';
      
      if (options.fadeIn) {
          filters.push({
              filter: 'afade',
              options: `t=in:st=0:d=${options.fadeIn}`,
              inputs: currentA,
              outputs: 'afIn'
          });
          currentA = 'afIn';
      }
      
      if (options.fadeOut && duration > 0) {
          const startOut = Math.max(0, duration - options.fadeOut);
          filters.push({
              filter: 'afade',
              options: `t=out:st=${startOut}:d=${options.fadeOut}`,
              inputs: currentA,
              outputs: 'afOut'
          });
          currentA = 'afOut';
      }
      
      if (filters.length > 0) {
          cmd.complexFilter(filters);
      }

      // map video from first, audio from second (or filtered chain)
      cmd.outputOptions([
          '-map 0:v:0',
          filters.length > 0 ? `-map [${currentA}]` : '-map 1:a:0',
          '-c:v copy' // copy video stream directly
      ]);
      
      // shortest ensures the looped audio does not extend video duration
      if (options.loop) {
          cmd.outputOptions(['-shortest']);
      }

      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `replaceAudio failed: ${e.message}`);
  } finally {
    await cleanupVideo();
    await cleanupAudio();
  }
}
