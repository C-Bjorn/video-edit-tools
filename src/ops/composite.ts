import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, CompositeOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { withOutput } from '../utils/run-ffmpeg.js';
import { ok, err } from '../utils/result.js';

export async function composite(input: VideoInput, options: CompositeOptions): Promise<Result<Buffer>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  const loadedImages: { path: string; cleanup: () => Promise<void> }[] = [];

  try {
    for (const layer of options.layers) {
       const res = await loadVideo(layer.image, 'png');
       if (!res.ok) throw new Error(res.error);
       loadedImages.push(res.data);
    }

    const buffer = await withOutput('mp4', () => {
      const cmd = Ffmpeg(inputPath);
      
      // setup inputs
      for (const img of loadedImages) {
          cmd.input(img.path);
      }

      // filters
      const filterGraph: string[] = [];
      let lastOutput = '0:v';

      for (let i = 0; i < options.layers.length; i++) {
         const layer = options.layers[i];
         const inputIndex = i + 1; // 0 is main video
         const imgRef = `[${inputIndex}:v]`;
         let currentImgLayer = imgRef;
         
         // apply scale if needed
         if (layer.width || layer.height) {
            const w = layer.width || '-1';
            const h = layer.height || '-1';
            filterGraph.push(`${currentImgLayer}scale=${w}:${h}[scaled${i}]`);
            currentImgLayer = `[scaled${i}]`;
         }
         
         // apply opacity if needed using colorchannelmixer=aa=opacity
         if (layer.opacity !== undefined && layer.opacity < 1.0) {
            filterGraph.push(`${currentImgLayer}format=rgba,colorchannelmixer=aa=${layer.opacity}[alpha${i}]`);
            currentImgLayer = `[alpha${i}]`;
         }
         
         let enable = '';
         if (layer.startTime !== undefined && layer.endTime !== undefined) {
             enable = `:enable='between(t,${layer.startTime},${layer.endTime})'`;
         } else if (layer.startTime !== undefined) {
             enable = `:enable='gte(t,${layer.startTime})'`;
         } else if (layer.endTime !== undefined) {
             enable = `:enable='lte(t,${layer.endTime})'`;
         }
         
         const outRef = `[outv${i}]`;
         // overlay lastOutput with currentImgLayer
         filterGraph.push(`${lastOutput}${currentImgLayer}overlay=x=${layer.x}:y=${layer.y}${enable}${outRef}`);
         lastOutput = outRef;
      }

      if (filterGraph.length > 0) {
          cmd.complexFilter(filterGraph, lastOutput.replace(/\[|\]/g, ''));
      }

      return cmd;
    });

    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `composite failed: ${e.message}`);
  } finally {
    await cleanup();
    for (const img of loadedImages) {
        await img.cleanup();
    }
  }
}
