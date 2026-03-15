import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pipeline } from '../../src/ops/pipeline.js';
import { getMetadata } from '../../src/ops/get-metadata.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const sampleMp4 = path.join(fixturesDir, 'sample.mp4');

describe('E2E Pipeline', () => {
    it('generates a short-form clip with text and convert operations', async () => {
        const result = await pipeline(sampleMp4, [
            { op: 'trim', start: 0, end: 3 },
            { op: 'resize', width: 720, height: 1280, fit: 'cover' },
            { 
               op: 'addText', 
               layers: [{ 
                   text: 'Sample HighLight', 
                   x: 360, 
                   y: 100, 
                   fontSize: 48, 
                   color: '#ffffff',
                   fontUrl: 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf'
               }] 
            },
            { op: 'convert', format: 'mp4', quality: 50 },
        ]);

        if (!result.ok) {
            console.error(result.error);
        }
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const meta = await getMetadata(result.data);
        expect(meta.ok).toBe(true);
        if (!meta.ok) return;

        expect(meta.data.duration).toBeCloseTo(3, 0);
        expect(meta.data.width).toBe(720);
        expect(meta.data.height).toBe(1280);
    }, { timeout: 60000 });
});
