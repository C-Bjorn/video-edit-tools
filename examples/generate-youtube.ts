import { pipeline, getMetadata, generateThumbnail } from '../src/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { gradientOverlay, addText } from 'image-edit-tools';

async function generateYoutubeVideo() {
    console.log('🎬 Starting YouTube Full Video generation (30s) with image-edit-tools and BGM...');
    
    const examplesDir = process.cwd();
    const assetsDir = path.join(examplesDir, 'examples', 'assets');
    const bgmPath = path.join(assetsDir, 'Cheek To Cheek.mp3');
    const outputPath = path.join(examplesDir, 'examples', 'output-youtube.mp4');
    const outThumbPath = path.join(examplesDir, 'examples', 'output-youtube-thumbnail.jpg');
    const tmpDir = path.join(examplesDir, 'tmp');

    await fs.mkdir(tmpDir, { recursive: true });

    try {
        await fs.access(bgmPath);
    } catch {
        console.error(`❌ Background music missing at ${bgmPath}`);
        process.exit(1);
    }

    const scenes = [
        { title: 'video-edit-tools Full SDK Tutorial', sub: '(Deterministic AI Video Generation)', color: '#0f3460', grad: '#16213e' },
        { title: 'Built with Type Safety in Mind', sub: 'Native TypeScript & JSDoc', color: '#16213e', grad: '#1a1a2e' },
        { title: 'Deep integration with FFmpeg', sub: 'Automated filter chains & operations', color: '#1a1a2e', grad: '#e94560' },
        { title: 'Audio & Subtitle Syncing', sub: 'Easily add overlays and BGM tracks', color: '#e94560', grad: '#16213e' },
        { title: 'Deterministic Output', sub: 'Predictable and reliable content', color: '#16213e', grad: '#0f3460' },
        { title: 'Ship Next-Gen Apps', sub: 'Connect to your AI Agents via MCP', color: '#0f3460', grad: '#e94560' }
    ];

    const segmentPaths: string[] = [];
    const sharp = (await import('sharp')).default;
    const Ffmpeg = (await import('fluent-ffmpeg')).default;

    console.log('🖼️  Generating 6 dynamic 16:9 scenes (5s each)...');
    
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const bgImagePath = path.join(tmpDir, `youtube-bg-${i}.png`);
        const segVideoPath = path.join(tmpDir, `youtube-seg-${i}.mp4`);

        const blankBuffer = await sharp({
            create: { width: 1920, height: 1080, channels: 4, background: scene.color }
        }).png().toBuffer();

        const withGradient = await gradientOverlay(blankBuffer, {
            direction: 'right', color: scene.grad, opacity: 0.8, coverage: 1.0
        });
        if (!withGradient.ok) throw new Error('Failed to add gradient');

        const finalBg = await addText(withGradient.data as Buffer, {
             layers: [
                 { text: scene.title, fontFamily: 'Arial', fontSize: 70, color: '#ffffff', x: 960, y: 450, anchor: 'center' },
                 { text: scene.sub, fontFamily: 'Arial', fontSize: 40, color: '#aaccff', x: 960, y: 560, anchor: 'center' }
             ]
        });
        if (!finalBg.ok) throw new Error('Failed to add text');
        
        await fs.writeFile(bgImagePath, finalBg.data as Buffer);

        // Convert single image to a 5-second 16:9 video WITH SILENT AUDIO
        await new Promise<void>((resolve, reject) => {
             Ffmpeg(bgImagePath)
                .loop(5.0) 
                .input('anullsrc=channel_layout=stereo:sample_rate=44100')
                .inputFormat('lavfi')
                .fps(30)
                .videoCodec('libx264')
                .audioCodec('aac')
                .format('mp4')
                .outputOptions(['-pix_fmt', 'yuv420p', '-shortest'])
                .save(segVideoPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
        
        segmentPaths.push(segVideoPath);
    }

    console.log('🎶 Combining segments, adding Audio and 📝 Subtitles...');
    
    const srtContent = `1
00:00:00,000 --> 00:00:04,500
Welcome to the video-edit-tools full tutorial!

2
00:00:05,000 --> 00:00:09,500
Developed entirely with robust type safety.

3
00:00:10,000 --> 00:00:14,500
Combining ffmpeg power seamlessly using Node.

4
00:00:15,000 --> 00:00:19,500
Synchronize audio and overlay dynamic subtitles easily.

5
00:00:20,000 --> 00:00:24,500
Deterministic and highly predictable video rendering.

6
00:00:25,000 --> 00:00:29,500
Start integrating this right into your AI workflows!
`;

    const srtTempPath = path.join(tmpDir, 'youtube-30s.srt');
    await fs.writeFile(srtTempPath, srtContent);

    const baseInput = segmentPaths[0];
    const concatInputs = segmentPaths.slice(1);

    const result = await pipeline(baseInput, [
        {
            op: 'concat',
            inputs: concatInputs
        },
        {
            op: 'replaceAudio',
            audio: bgmPath,
            fadeIn: 1,
            fadeOut: 3,
            loop: true
        },
        {
            op: 'addSubtitles',
            subtitles: srtTempPath,
            style: {
                 fontSize: 36,
                 color: '#ffffff',
                 outline: true,
                 position: 'bottom'
            }
        }
    ]);

    if (!result.ok) {
        console.error('❌ Failed to generate Video:', result.error);
        return;
    }

    await fs.writeFile(outputPath, result.data as Buffer);
    
    // 4. Generate Thumbnail from the 15-second mark (middle of the video)
    console.log('📸 Generating YouTube Thumbnail...');
    const thumbResult = await generateThumbnail(outputPath, {
        time: 15,
        width: 1920,
        height: 1080,
        format: 'jpeg',
        count: 1
    });

    if (thumbResult.ok && !Array.isArray(thumbResult.data)) {
         await fs.writeFile(outThumbPath, thumbResult.data as Buffer);
    }

    const meta = await getMetadata(outputPath);
    if (meta.ok) {
        console.log('✅ Success! YouTube Video generated at:', outputPath);
        console.log('✅ Success! Thumbnail generated at:', outThumbPath);
        console.log(`📊 Video Stats: ${meta.data.width}x${meta.data.height}, ${meta.data.duration}s, ${meta.data.fps} FPS`);
    }

    // Cleanup
    for (let i = 0; i < scenes.length; i++) {
        await fs.unlink(path.join(tmpDir, `youtube-bg-${i}.png`)).catch(() => {});
        await fs.unlink(segmentPaths[i]).catch(() => {});
    }
    await fs.unlink(srtTempPath).catch(() => {});
}

generateYoutubeVideo().catch(console.error);
