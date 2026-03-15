import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, VideoTextLayer, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import fetch from 'node-fetch';
import fs from 'node:fs/promises';

export async function addText(input: VideoInput, options: { layers: VideoTextLayer[] }): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  const tmpFonts: string[] = [];

  try {
    const filters: string[] = [];

    for (const layer of options.layers) {
      let fontfile = '';
      if (layer.fontUrl) {
          const res = await fetch(layer.fontUrl);
          if (res.ok) {
              const fontPath = generateTmpFilePath('ttf');
              const buffer = await res.arrayBuffer();
              await fs.writeFile(fontPath, Buffer.from(buffer));
              tmpFonts.push(fontPath);
              fontfile = fontPath;
          }
      }

      // Escape text for ffmpeg drawtext
      const text = layer.text.replace(/'/g, "\\'").replace(/:/g, '\\:');
      
      let filter = `drawtext=text='${text}':x=${layer.x}:y=${layer.y}:fontsize=${layer.fontSize}`;
      
      if (layer.color) {
          filter += `:fontcolor=${layer.color}`;
      }
      
      if (fontfile) {
          // Normalize backslashes for Windows if necessary, though we just replace them all
          filter += `:fontfile='${fontfile.replace(/\\/g, '/')}'`;
      }
      
      if (layer.stroke) {
          filter += `:borderw=${layer.stroke.width}:bordercolor=${layer.stroke.color}`;
      }
      
      if (layer.background) {
          filter += `:box=1:boxcolor=${layer.background.color}:boxborderw=${layer.background.padding || 0}`;
      }
      
      let enableCondition = '';
      if (layer.startTime !== undefined && layer.endTime !== undefined) {
          enableCondition = `between(t,${layer.startTime},${layer.endTime})`;
      } else if (layer.startTime !== undefined) {
          enableCondition = `gte(t,${layer.startTime})`;
      } else if (layer.endTime !== undefined) {
          enableCondition = `lte(t,${layer.endTime})`;
      }
      
      if (enableCondition) {
          filter += `:enable='${enableCondition}'`;
      }
      
      filters.push(filter);
    }

    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      if (filters.length > 0) {
          cmd.videoFilters(filters);
      }
      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `addText failed: ${e.message}`);
  } finally {
    await cleanup();
    for (const font of tmpFonts) {
        await cleanupTmpFile(font);
    }
  }
}
