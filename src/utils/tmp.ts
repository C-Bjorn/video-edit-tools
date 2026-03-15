import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { VideoInput } from '../types.js';

// 규칙:
// 1. 모든 임시 파일은 os.tmpdir() 하위에 'vet-' 접두사로 생성
// 2. 각 함수 실행이 끝나면 (성공/실패 무관) 임시 파일 삭제
// 3. process 종료 시 남은 임시 파일 정리 (process.on('exit'))
// 4. 임시 파일명: `vet-${randomUUID()}.${ext}`

const generatedFiles = new Set<string>();

process.on('exit', () => {
  for (const file of generatedFiles) {
    try {
      // Using native fs sync to ensure it happens during process exit
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').unlinkSync(file);
    } catch {
      // Ignore errors on exit
    }
  }
});

export function generateTmpFilePath(ext: string): string {
  const fileExt = ext.startsWith('.') ? ext : `.${ext}`;
  const filePath = path.join(os.tmpdir(), `vet-${crypto.randomUUID()}${fileExt}`);
  generatedFiles.add(filePath);
  return filePath;
}

export async function cleanupTmpFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    generatedFiles.delete(filePath);
  } catch {
    // Ignore error if file doesn't exist
  }
}

/**
 * Creates a temp file if input is a buffer, runs fn, and then cleans up.
 * If input is a path, it just runs fn with the path.
 */
export async function withTmpFile<T>(
  input: VideoInput,
  ext: string,
  fn: (path: string) => Promise<T>
): Promise<T> {
  if (Buffer.isBuffer(input)) {
    const tmpPath = generateTmpFilePath(ext);
    try {
      await fs.writeFile(tmpPath, input);
      return await fn(tmpPath);
    } finally {
      await cleanupTmpFile(tmpPath);
    }
  }

  // Treat as string (filePath or URL, caller should handle URL specifically using load-video)
  return await fn(input);
}
