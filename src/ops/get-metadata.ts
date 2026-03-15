import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, VideoMetadata, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { ok, err } from '../utils/result.js';
import { runFfmpeg } from '../utils/run-ffmpeg.js';

export async function getMetadata(input: VideoInput): Promise<Result<VideoMetadata>> {
  const loaded = await loadVideo(input);
  if (!loaded.ok) return loaded;

  const { path, cleanup } = loaded.data;

  try {
    return await new Promise<Result<VideoMetadata>>((resolve) => {
      Ffmpeg.ffprobe(path, (err, data) => {
        if (err) {
          resolve(err(ErrorCode.PROCESSING_FAILED, `ffprobe failed: ${err.message}`));
          return;
        }

        const videoStream = data.streams.find((s) => s.codec_type === 'video');
        const audioStream = data.streams.find((s) => s.codec_type === 'audio');

        if (!videoStream) {
          resolve(err(ErrorCode.UNSUPPORTED_FORMAT, 'No video stream found'));
          return;
        }

        const metadata: VideoMetadata = {
          duration: data.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: evalFps(videoStream.r_frame_rate || '0/1'),
          codec: videoStream.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || null,
          bitrate: (data.format.bit_rate && parseInt(String(data.format.bit_rate), 10) / 1000) || 0,
          size: (data.format.size && parseInt(String(data.format.size), 10)) || 0,
          format: data.format.format_name || 'unknown',
        };

        resolve(ok(metadata));
      });
    });
  } catch (e: any) {
    return err(ErrorCode.PROCESSING_FAILED, `Failed to get metadata: ${e.message}`);
  } finally {
    await cleanup();
  }
}

function evalFps(fpsString: string): number {
  if (!fpsString) return 0;
  const parts = fpsString.split('/');
  if (parts.length === 2 && parseInt(parts[1], 10) > 0) {
    return parseInt(parts[0], 10) / parseInt(parts[1], 10);
  }
  return parseInt(fpsString, 10) || 0;
}
