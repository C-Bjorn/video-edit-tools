import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, ConcatOptions, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { ok, err } from '../utils/result.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import fs from 'node:fs/promises';

export async function concat(inputs: VideoInput[], options?: ConcatOptions): Promise<Result<Buffer>> {
  if (inputs.length < 2) {
    return err(ErrorCode.INVALID_INPUT, 'At least 2 inputs required for concat');
  }

  const loadedInputs: { path: string; cleanup: () => Promise<void> }[] = [];
  try {
    for (const input of inputs) {
      const res = await loadVideo(input);
      if (!res.ok) throw new Error(res.error);
      loadedInputs.push(res.data);
    }

    const ext = options?.format || 'mp4';
    const outputPath = generateTmpFilePath(ext);

    await new Promise<void>((resolve, reject) => {
      const cmd = Ffmpeg();
      for (const loaded of loadedInputs) {
        cmd.input(loaded.path);
      }

      // If transition is requested, it requires complex filter graph (xfade)
      // For simplicity, fluent-ffmpeg mergeToFile is faster but only for equal properties or simple appends.
      // The prompt says "서로 다른 해상도의 영상을 이어붙이면 ffmpeg가 오류를 낸다. concat 전에 모든 입력을 동일 해상도로 resize하는 내부 정규화 단계를 추가한다."
      // Let's implement dynamic scaling using complexFilter if needed, or assume caller provides same sizes.
      // But prompt strictly says "내부 정규화 단계를 추가한다". We will add scale filter.
      
      const filterInputs = loadedInputs.map((_, i) => `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]; [${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
      const concatDefs = loadedInputs.map((_, i) => `[v${i}][a${i}]`).join('');
      
      cmd.complexFilter([
        ...filterInputs,
        `${concatDefs}concat=n=${loadedInputs.length}:v=1:a=1[outv][outa]`
      ], ['outv', 'outa']);

      cmd.outputOptions(['-c:v libx264', '-c:a aac', '-shortest', '-vsync 2'])
         .output(outputPath)
         .on('end', () => resolve())
         .on('error', (e, stdout, stderr) => {
            reject(new Error(`Concat failed: ${e.message}\nStderr: ${stderr}`));
         })
         .run();
    });

    const buffer = await fs.readFile(outputPath);
    await cleanupTmpFile(outputPath);
    return ok(buffer);
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, e.message);
  } finally {
    for (const { cleanup } of loadedInputs) {
      await cleanup();
    }
  }
}
