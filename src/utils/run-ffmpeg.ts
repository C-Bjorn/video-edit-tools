import fs from 'node:fs/promises';
import Ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { generateTmpFilePath, cleanupTmpFile } from './tmp.js';

// Initialize ffmpeg paths
Ffmpeg.setFfmpegPath(ffmpegPath.path);
Ffmpeg.setFfprobePath(ffprobePath.path);

/**
 * Executes a fluent-ffmpeg command and returns a promise.
 */
export function runFfmpeg(command: Ffmpeg.FfmpegCommand, outputPath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    command
      .on('end', () => resolve(outputPath || ''))
      .on('error', (err, stdout, stderr) => {
        reject(new Error(`FFmpeg failed: ${err.message}\nStderr: ${stderr}`));
      });
      
    // The command is expected to be configured with .output(outputPath). Here we trigger it.
    command.run();
  });
}

/**
 * Creates a unique output temporary file, sets it via fluent-ffmpeg .output(),
 * runs the command, reads the output as a Buffer, and cleans up the temporary file.
 */
export async function withOutput(
  ext: string,
  fn: (outputPath: string) => Ffmpeg.FfmpegCommand
): Promise<Buffer> {
  const tmpOut = generateTmpFilePath(ext);
  try {
    const cmd = fn(tmpOut);
    // Explicitly set the output path to ensure the command saves correctly
    cmd.output(tmpOut);
    await runFfmpeg(cmd, tmpOut);
    const data = await fs.readFile(tmpOut);
    return data;
  } finally {
    await cleanupTmpFile(tmpOut);
  }
}
