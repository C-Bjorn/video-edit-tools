import { pipeline, getMetadata, generateThumbnail } from '../src/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { gradientOverlay, addText } from 'image-edit-tools';

/**
 * Full YouTube Video Workflow Example
 * 
 * Demonstrates:
 * 1. Generating a 16:9 background using image-edit-tools
 * 2. Converting it to a base video
 * 3. Adding explanatory subtitles and background music
 * 4. Generating a thumbnail
 */
async function generateYoutubeVideo() {
    console.log('🎬 Starting YouTube Full Video generation with image-edit-tools and BGM...');
    
    const examplesDir = process.cwd();
    const assetsDir = path.join(examplesDir, 'examples', 'assets');
    const bgmPath = path.join(assetsDir, 'Will You Still Love Me Tomorrow.mp3');
    
    const outputPath = path.join(examplesDir, 'examples', 'output-youtube.mp4');
    const outThumbPath = path.join(examplesDir, 'examples', 'output-youtube-thumbnail.jpg');
    
    const tempVideoPath = path.join(examplesDir, 'tmp', 'youtube-temp.mp4');
    const bgImagePath = path.join(examplesDir, 'tmp', 'youtube-bg.png');
    const srtTempPath = path.join(examplesDir, 'tmp', 'youtube.srt');

    await fs.mkdir(path.join(examplesDir, 'tmp'), { recursive: true });

    try {
        await fs.access(bgmPath);
    } catch {
        console.error(`❌ Background music missing at ${bgmPath}`);
        process.exit(1);
    }

    // 1. Create Background Image using image-edit-tools
    console.log('🖼️  Generating 16:9 background image...');
    
    const sharp = (await import('sharp')).default;
    const blankBuffer = await sharp({
        create: {
            width: 1920,
            height: 1080,
            channels: 4,
            background: { r: 15, g: 52, b: 96, alpha: 1 } // #0f3460
        }
    }).png().toBuffer();

    const withGradient = await gradientOverlay(blankBuffer, {
        direction: 'right',
        color: '#16213e',
        opacity: 0.8,
        coverage: 1.0
    });
    if (!withGradient.ok) throw new Error('Failed to add gradient');

    // Add title text
    const finalBg = await addText(withGradient.data, {
         layers: [{
             text: 'video-edit-tools Full SDK Tutorial',
             fontFamily: 'Arial',
             fontSize: 70,
             color: '#ffffff',
             x: 960,
             y: 450,
             anchor: 'center'
         },
         {
             text: '(Deterministic AI Video Generation)',
             fontFamily: 'Arial',
             fontSize: 40,
             color: '#aaccff',
             x: 960,
             y: 560,
             anchor: 'center'
         }]
    });
    if (!finalBg.ok) throw new Error('Failed to add text');
    
    await fs.writeFile(bgImagePath, finalBg.data as Buffer);

    // 2. Convert single image to a 10-second 16:9 video
    console.log('🎞️  Converting image to base video...');
    const Ffmpeg = (await import('fluent-ffmpeg')).default;
    await new Promise<void>((resolve, reject) => {
         Ffmpeg(bgImagePath)
            .loop(10) // 10 seconds
            .fps(30)
            .videoCodec('libx264')
            .format('mp4')
            .outputOptions(['-pix_fmt', 'yuv420p'])
            .save(tempVideoPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });

    // 3. Add Background Music and Subtitles
    console.log('🎶 Adding Audio and 📝 Subtitles...');
    
    const srtContent = `1
00:00:01,000 --> 00:00:03,500
Welcome to the video-edit-tools full tutorial.

2
00:00:04,000 --> 00:00:06,500
Just like the shorts example, this is fully automated.

3
00:00:07,000 --> 00:00:09,500
Using image-edit-tools + ffmpeg pipelines natively in Node.js.
`;

    await fs.writeFile(srtTempPath, srtContent);

    const result = await pipeline(tempVideoPath, [
        {
            op: 'replaceAudio',
            audio: bgmPath,
            fadeIn: 1,
            fadeOut: 2,
            loop: true
        },
        {
            op: 'addSubtitles',
            subtitles: srtTempPath,
            style: {
                 fontSize: 32,
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
    
    // 4. Generate Thumbnail from the 5-second mark
    console.log('📸 Generating YouTube Thumbnail...');
    const thumbResult = await generateThumbnail(outputPath, {
        time: 5,
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
    await fs.unlink(tempVideoPath).catch(() => {});
    await fs.unlink(bgImagePath).catch(() => {});
    await fs.unlink(srtTempPath).catch(() => {});
}

generateYoutubeVideo().catch(console.error);
