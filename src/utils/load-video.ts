import fetch from 'node-fetch';
import fs from 'node:fs/promises';
import { VideoInput, Result, ErrorCode } from '../types.js';
import { ok, err } from './result.js';
import { generateTmpFilePath, cleanupTmpFile } from './tmp.js';

/**
 * Normalizes VideoInput into a local file path.
 * If input is Buffer, writes to a temp file and returns its path + cleanup function.
 * If input is URL, downloads to a temp file and returns its path + cleanup function.
 * If input is string (local path), returns it directly with a no-op cleanup function.
 */
export async function loadVideo(
  input: VideoInput,
  ext: string = 'mp4'
): Promise<Result<{ path: string; cleanup: () => Promise<void> }>> {
  if (Buffer.isBuffer(input)) {
    const tmpPath = generateTmpFilePath(ext);
    try {
      await fs.writeFile(tmpPath, input);
      return ok({
        path: tmpPath,
        cleanup: () => cleanupTmpFile(tmpPath),
      });
    } catch (e: any) {
      return err(ErrorCode.PROCESSING_FAILED, `Failed to write buffer to tmp file: ${e.message}`);
    }
  }

  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const tmpPath = generateTmpFilePath(ext);
      try {
        const res = await fetch(input);
        if (!res.ok) {
          return err(ErrorCode.FETCH_FAILED, `Failed to fetch URL: ${res.statusText}`);
        }
        const buffer = await res.arrayBuffer();
        await fs.writeFile(tmpPath, Buffer.from(buffer));
        return ok({
          path: tmpPath,
          cleanup: () => cleanupTmpFile(tmpPath),
        });
      } catch (e: any) {
        return err(ErrorCode.FETCH_FAILED, `Fetch error: ${e.message}`);
      }
    }

    // Treat as local file path
    try {
      await fs.access(input);
      return ok({
        path: input,
        cleanup: async () => {}, // no-op for local files
      });
    } catch {
      return err(ErrorCode.FILE_NOT_FOUND, `File not found: ${input}`);
    }
  }

  return err(ErrorCode.INVALID_INPUT, 'Invalid video input type. Expected Buffer or string.');
}
