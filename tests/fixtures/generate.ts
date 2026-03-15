import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

// Generate mock files
async function generateFixtures() {
    const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
    await fs.mkdir(fixturesDir, { recursive: true });

    const mp4Path = path.join(fixturesDir, 'sample.mp4');
    const mp3Path = path.join(fixturesDir, 'sample.mp3');
    const srtPath = path.join(fixturesDir, 'sample.srt');

    console.log("Generating sample.mp4 (5s video with color bars and 1kHz tone)...");
    const Ffmpeg = (await import('fluent-ffmpeg')).default;
    const ffmpegPath = (await import('@ffmpeg-installer/ffmpeg')).default;
    Ffmpeg.setFfmpegPath(ffmpegPath.path);

    await new Promise<void>((resolve, reject) => {
        Ffmpeg()
            .input('smptebars=size=640x360:rate=30')
            .inputFormat('lavfi')
            .input('sine=frequency=1000:sample_rate=44100')
            .inputFormat('lavfi')
            .outputOptions(['-t 5'])
            .output(mp4Path)
            .on('end', () => resolve())
            .on('error', (e) => reject(e))
            .run();
    });

    console.log("Generating sample.mp3 (5s audio sine wave)...");
    await new Promise<void>((resolve, reject) => {
        Ffmpeg()
            .input('sine=frequency=440:sample_rate=44100')
            .inputFormat('lavfi')
            .outputOptions(['-t 5'])
            .output(mp3Path)
            .on('end', () => resolve())
            .on('error', (e) => reject(e))
            .run();
    });

    console.log("Generating sample.srt...");
    const srtContent = `1
00:00:01,000 --> 00:00:02,500
Hello, World! This is the first subtitle.

2
00:00:03,000 --> 00:00:04,500
And this is the second subtitle layer.
`;
    await fs.writeFile(srtPath, srtContent);
    console.log("Done.");
}

generateFixtures().catch(console.error);
