import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, DetectScenesOptions, SceneDetectResult, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { getMetadata } from './get-metadata.js';
import { generateThumbnail } from './generate-thumbnail.js';
import { ok, err } from '../utils/result.js';

export async function detectScenes(input: VideoInput, options?: DetectScenesOptions): Promise<Result<SceneDetectResult>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;
  const { path: inputPath, cleanup } = loaded.data;

  try {
    const meta = await getMetadata(input);
    const duration = meta.ok ? meta.data.duration : 0;
    
    const threshold = options?.threshold !== undefined ? options.threshold : 0.4;
    
    const sceneTimes: number[] = [0]; // always start with 0

    await new Promise<void>((resolve, reject) => {
        Ffmpeg(inputPath)
            .outputOptions(['-f null'])
            .videoFilters([`select='gt(scene,${threshold})'`, 'showinfo'])
            .on('stderr', (stderrLine: string) => {
                // Parse stdout/stderr for pts_time
                // Example: [Parsed_showinfo_1 @ 0x...] n:   0 pts:  60060 pts_time:0.667333
                const match = stderrLine.match(/pts_time:([\d.]+)/);
                if (match && match[1]) {
                    sceneTimes.push(parseFloat(match[1]));
                }
            })
            .on('end', () => resolve())
            .on('error', (e) => reject(new Error(`detectScenes failed: ${e.message}`)))
            .output('-')
            .run();
    });

    const scenes: Array<{ start: number; end: number; thumbnail?: Buffer }> = [];

    for (let i = 0; i < sceneTimes.length; i++) {
        const start = sceneTimes[i];
        const end = (i + 1 < sceneTimes.length) ? sceneTimes[i + 1] : duration;

        if (options?.minSceneDuration && (end - start) < options.minSceneDuration) {
            continue; // Skip too short scenes, though this can make things disjointed
        }
        
        // Ensure valid ranges
        const safeEnd = end > start ? end : start + 0.1;
        
        let thumbnail;
        // The spec specifies thumbnail as optional Buffer. Let's fetch it if possible.
        // It's expensive to fetch thumbnails for every scene here, but if requested we could.
        // For simplicity and to follow the prompt's implied spec, we might just try. Wait, it's easier to skip if no flag, but user interface expects it.
        // Let's generate a thumbnail for each scene. To avoid huge overhead, only if we can do it quickly.
        const tbRes = await generateThumbnail(input, { time: start, format: 'jpeg', width: 320, height: 180 });
        if (tbRes.ok && !Array.isArray(tbRes.data)) {
             thumbnail = tbRes.data;
        }

        scenes.push({ start, end: safeEnd, thumbnail });
    }

    return ok({ scenes, count: scenes.length });
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, e.message);
  } finally {
    await cleanup();
  }
}
