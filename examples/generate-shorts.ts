import { pipeline, getMetadata } from '../src/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * YouTube Shorts / TikTok Style Video Generator Example
 * 
 * This example demonstrates how to:
 * 1. Take a standard 16:9 1080p horizontal video
 * 2. Crop/Resize it into a 9:16 vertical video (1080x1920) for Shorts
 * 3. Add dynamic styling (text overlay for a title/hook)
 * 4. Apply a filter (e.g., slight contrast or vignette for punchiness)
 */
async function generateShorts() {
    console.log('🎬 Starting YouTube Shorts generation...');
    
    const examplesDir = process.cwd();
    // Assuming the user runs this from the project root: node dist/examples/generate-shorts.js
    const fixturesDir = path.join(examplesDir, 'tests', 'fixtures');
    const inputVideo = path.join(fixturesDir, 'sample.mp4');
    
    // Check if the sample input exists
    try {
        await fs.access(inputVideo);
    } catch {
        console.error(`❌ Example requires a sample video at ${inputVideo}`);
        console.error(`Please run 'npm run test' from the root directory first to generate the test fixtures.`);
        process.exit(1);
    }
    
    const outputPath = path.join(examplesDir, 'output-shorts.mp4');

    const result = await pipeline(inputVideo, [
        // 1. Convert horizontal to vertical format using the crop and resize tools.
        // Or simply use 'cover' fit on resize to center-crop automatically.
        { op: 'resize', width: 1080, height: 1920, fit: 'cover' },
        
        // 2. Add an engaging text overlay (hook) at the top
        { 
            op: 'addText', 
            layers: [
                {
                    text: 'WAIT FOR IT... 😱',
                    x: 540, // center of 1080
                    y: 200, // near the top
                    fontSize: 80,
                    color: '#ffffff',
                    // Using a Google Font (requires internet access)
                    fontUrl: 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Black.ttf'
                },
                {
                    text: 'Like & Subscribe',
                    x: 540,
                    y: 1600, // near the bottom
                    fontSize: 60,
                    color: '#ff0000',
                    fontUrl: 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf'
                }
            ]
        },
        
        // 3. Make colors punchier for social media
        { op: 'adjust', contrast: 1.2, saturation: 1.3 },
        
        // 4. Save to a final mp4 (pipeline automatically saves intermediate states, this finalizes it)
        { op: 'convert', format: 'mp4', quality: 80 }
    ]);

    if (!result.ok) {
        console.error('❌ Failed to generate Shorts:', result.error);
        if (result.code) console.error(`Error Code: ${result.code}`);
        return;
    }

    // Pipeline returns a Result<Buffer> containing the video data
    const generatedBuffer = result.data;
    
    // Save it to our examples directory
    await fs.writeFile(outputPath, generatedBuffer);
    
    const meta = await getMetadata(outputPath);
    if (meta.ok) {
        console.log('✅ Success! YouTube Shorts video generated at:', outputPath);
        console.log(`📊 Video Stats: ${meta.data.width}x${meta.data.height}, ${meta.data.duration}s, ${meta.data.fps} FPS`);
    }
}

generateShorts().catch(console.error);
