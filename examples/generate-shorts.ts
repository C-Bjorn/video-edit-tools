import { pipeline, getMetadata, replaceAudio, addSubtitles } from '../src/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { gradientOverlay, addText } from 'image-edit-tools';

/**
 * YouTube Shorts / TikTok Style Video Generator Example
 * 
 * Demonstrates:
 * 1. Using image-edit-tools to generate a dynamic background image
 * 2. Creating a 10-second video from that image using ffmpeg directly (or via convert hack)
 * 3. Adding background music (replaceAudio)
 * 4. Adding explanatory subtitles (addSubtitles)
 */
async function generateShorts() {
    console.log('🎬 Starting YouTube Shorts generation (30s) with dynamic scenes...');
    
    const examplesDir = process.cwd();
    const assetsDir = path.join(examplesDir, 'examples', 'assets');
    const bgmPath = path.join(assetsDir, 'Cheek To Cheek.mp3');
    const outputPath = path.join(examplesDir, 'examples', 'output-shorts.mp4');
    const tmpDir = path.join(examplesDir, 'tmp');
    
    // Ensure tmp dir exists
    await fs.mkdir(tmpDir, { recursive: true });

    try {
        await fs.access(bgmPath);
    } catch {
        console.error(`❌ Background music missing at ${bgmPath}`);
        process.exit(1);
    }

    const scenes = [
        { title: 'video-edit-tools', sub: 'SDK Demo', color: '#1a1a2e', grad: '#e94560' },
        { title: 'Deterministic', sub: 'AI Video Gen', color: '#16213e', grad: '#0f3460' },
        { title: 'Powered by', sub: 'FFmpeg & Node', color: '#0f3460', grad: '#e94560' },
        { title: 'Rich Features', sub: 'Audio & Overlays', color: '#1a1a2e', grad: '#43c6ac' },
        { title: 'Pipelines', sub: 'Batch Processing', color: '#191654', grad: '#43C6AC' },
        { title: 'Ready for', sub: 'AI Agents!', color: '#ff4b1f', grad: '#ff9068' }
    ];

    const segmentPaths: string[] = [];

    const sharp = (await import('sharp')).default;
    const Ffmpeg = (await import('fluent-ffmpeg')).default;

    console.log('🖼️  Generating 6 dynamic scenes (5s each)...');
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const bgImagePath = path.join(tmpDir, `shorts-bg-${i}.png`);
        const segVideoPath = path.join(tmpDir, `shorts-seg-${i}.mp4`);

        // Create base color image using sharp buffer parsing
        // Extract RGB roughly from hex (simplified for example, using sharp hex parsing if available, or just fallback)
        const blankBuffer = await sharp({
            create: { width: 1080, height: 1920, channels: 4, background: scene.color }
        }).png().toBuffer();

        // Add gradient
        const withGradient = await gradientOverlay(blankBuffer, {
            direction: 'top', color: scene.grad, opacity: 0.7, coverage: 0.8
        });
        if (!withGradient.ok) throw new Error('Failed gradient');

        // Add text
        const finalBg = await addText(withGradient.data as Buffer, {
             layers: [
                 { text: scene.title, fontFamily: 'Arial', fontSize: 90, color: '#ffffff', x: 540, y: 800, anchor: 'center' },
                 { text: scene.sub, fontFamily: 'Arial', fontSize: 70, color: '#cccccc', x: 540, y: 950, anchor: 'center' }
             ]
        });
        if (!finalBg.ok) throw new Error('Failed addText');
        
        await fs.writeFile(bgImagePath, finalBg.data as Buffer);

        // Convert to 5-second segment with silent audio track so concat works
        await new Promise<void>((resolve, reject) => {
             Ffmpeg(bgImagePath)
                .loop(5.0) // 5 seconds per scene
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
    
    // Create subtitles for 30 seconds (5 seconds per scene)
    const srtContent = `1
00:00:00,000 --> 00:00:04,500
Welcome to video-edit-tools! A complete SDK.

2
00:00:05,000 --> 00:00:09,500
Fully deterministic video generation for AI.

3
00:00:10,000 --> 00:00:14,500
Powered natively by FFmpeg and Node.js.

4
00:00:15,000 --> 00:00:19,500
Easily manipulate audio, visual filters, and text.

5
00:00:20,000 --> 00:00:24,500
Chain operations with the powerful Pipeline API.

6
00:00:25,000 --> 00:00:29,500
Ready to be integrated into your AI Agents!
`;

    const srtTempPath = path.join(tmpDir, 'shorts-30s.srt');
    await fs.writeFile(srtTempPath, srtContent);

    // The first segment is our base input, the rest we concat
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
                 fontSize: 24,
                 color: '#ffffff',
                 outline: true,
                 position: 'center'
            }
        }
    ]);

    if (!result.ok) {
        console.error('❌ Failed to generate Shorts:', result.error);
        return;
    }

    await fs.writeFile(outputPath, result.data as Buffer);
    
    const meta = await getMetadata(outputPath);
    if (meta.ok) {
        console.log('✅ Success! YouTube Shorts video generated at:', outputPath);
        console.log(`📊 Video Stats: ${meta.data.width}x${meta.data.height}, ${meta.data.duration}s, ${meta.data.fps} FPS`);
    }

    // Cleanup
    for (let i = 0; i < scenes.length; i++) {
        await fs.unlink(path.join(tmpDir, `shorts-bg-${i}.png`)).catch(() => {});
        await fs.unlink(segmentPaths[i]).catch(() => {});
    }
    await fs.unlink(srtTempPath).catch(() => {});
}

generateShorts().catch(console.error);
