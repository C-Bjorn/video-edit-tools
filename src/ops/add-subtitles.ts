import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, AddSubtitlesOptions, SubtitleEntry, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import fs from 'node:fs/promises';

function formatTimeCode(t: number | string): string {
    if (typeof t === 'string') return t.replace('.', ',');
    const date = new Date(t * 1000);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

export async function addSubtitles(input: VideoInput, options: AddSubtitlesOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  let srtPath = '';
  let cleanupSrt = async () => {};

  try {
    if (typeof options.subtitles === 'string') {
        srtPath = options.subtitles;
    } else {
        // Generate SRT file
        srtPath = generateTmpFilePath('srt');
        cleanupSrt = () => cleanupTmpFile(srtPath);
        
        let srtContent = '';
        options.subtitles.forEach((sub, index) => {
            srtContent += `${index + 1}\n`;
            srtContent += `${formatTimeCode(sub.startTime)} --> ${formatTimeCode(sub.endTime)}\n`;
            srtContent += `${sub.text}\n\n`;
        });
        await fs.writeFile(srtPath, srtContent);
    }

    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      let styleOpts = '';
      if (options.style) {
          const styles: string[] = [];
          if (options.style.fontSize) styles.push(`FontSize=${options.style.fontSize}`);
          if (options.style.color) {
              const hex = options.style.color.replace('#', '');
              // ASS color format is BGR, not RGB. Wait, ffmpeg handles some standard color formats 
              // but we can just use FontName, PrimaryColour etc. Simplification:
              styles.push(`PrimaryColour=&H00${hex}`);
          }
          if (options.style.fontFamily) styles.push(`FontName=${options.style.fontFamily}`);
          
          if (styles.length > 0) {
              styleOpts = `:force_style='${styles.join(',')}'`;
          }
      }
      
      // We must escape the path for ffmpeg filter syntax
      const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      cmd.videoFilters([`subtitles='${escapedSrtPath}'${styleOpts}`]);
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `addSubtitles failed: ${e.message}`);
  } finally {
    await cleanup();
    await cleanupSrt();
  }
}
