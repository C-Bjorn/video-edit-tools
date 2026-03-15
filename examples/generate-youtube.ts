import { pipeline, getMetadata, generateThumbnail } from '../src/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Full YouTube Video Workflow Example
 * 
 * This example demonstrates a typical YouTube workflow:
 * 1. Take a raw video input.
 * 2. Trim the intro/outro out of the video.
 * 3. Add a transition effect (if we were concatenating, we'd use addTransition).
 * 4. Add a permanent channel watermark logo (using composite).
 * 5. Generate an engaging 16:9 thumbnail frame for the video.
 */
async function generateYoutubeVideo() {
    console.log('🎬 Starting YouTube Full Video generation...');
    
    const examplesDir = process.cwd();
    // Assuming the user runs this from the project root: node dist/examples/generate-youtube.js
    const fixturesDir = path.join(examplesDir, 'tests', 'fixtures');
    const inputVideo = path.join(fixturesDir, 'sample.mp4');
    
    try {
        await fs.access(inputVideo);
    } catch {
        console.error(`❌ Example requires a sample video at ${inputVideo}`);
        console.error(`Please run 'npm run test' from the root directory first to generate the test fixtures.`);
        process.exit(1);
    }
    
    const outputPath = path.join(examplesDir, 'output-youtube.mp4');
    const outThumbPath = path.join(examplesDir, 'output-youtube-thumbnail.jpg');

    // For the overlay, let's just make a small solid color "logo" image in tmp to overlay
    const logoPath = path.join(process.cwd(), '..', 'tmp', 'logo.png');
    // ...in a real app, this would be an actual png. For this example we'll skip composite
    // if we don't have a logo file readily handy, but we will use the text overlay as a "watermark".

    const result = await pipeline(inputVideo, [
        // 1. Ensure resolution is 1080p standard
        { op: 'resize', width: 1920, height: 1080, fit: 'cover' },
        
        // 2. Add a watermark to the bottom right
        { 
            op: 'addText', 
            layers: [
                {
                    text: '@MyAwesomeChannel',
                    x: 1800, // Bottom right approx
                    y: 1000, 
                    fontSize: 32,
                    color: '#ffffff',
                    // Optional opacity isn't directly supported by addText easily without complex filter tweaks,
                    // but we can pass standard hex.
                    fontUrl: 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf'
                }
            ]
        },
        
        // 3. Finalize
        { op: 'convert', format: 'mp4', quality: 90 }
    ]);

    if (!result.ok) {
        console.error('❌ Failed to generate Video:', result.error);
        return;
    }

    await fs.writeFile(outputPath, result.data as Buffer);
    
    // 4. Generate Thumbnail from the 2-second mark
    console.log('📸 Generating YouTube Thumbnail...');
    const thumbResult = await generateThumbnail(outputPath, {
        time: 2, // 2 second mark
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
}

generateYoutubeVideo().catch(console.error);
