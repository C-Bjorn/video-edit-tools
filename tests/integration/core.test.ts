import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { getMetadata } from '../../src/ops/get-metadata.js';
import { trim } from '../../src/ops/trim.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const sampleMp4 = path.join(fixturesDir, 'sample.mp4');

describe('getMetadata integration', () => {
    it('returns valid metadata for mp4', async () => {
        const res = await getMetadata(sampleMp4);
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        expect(res.data.duration).toBeCloseTo(5, 0); // 5s video
        expect(res.data.width).toBe(640);
        expect(res.data.height).toBe(360);
        expect(res.data.fps).toBe(30);
    });

    it('returns Error for missing file', async () => {
        const res = await getMetadata('doesnt-exist.mp4');
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.code).toBe('FILE_NOT_FOUND');
        }
    });
});

describe('trim integration', () => {
    it('trims video to specified range (start and end)', async () => {
        const result = await trim(sampleMp4, { start: 1, end: 3 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const meta = await getMetadata(result.data);
        expect(meta.ok).toBe(true);
        if (!meta.ok) return;

        // 1s to 3s is 2s duration
        expect(meta.data.duration).toBeCloseTo(2, 0);
    });

    it('trims video using start and duration', async () => {
        const result = await trim(sampleMp4, { start: 2, duration: 1.5 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const meta = await getMetadata(result.data);
        expect(meta.ok).toBe(true);
        if (!meta.ok) return;

        expect(meta.data.duration).toBeCloseTo(1.5, 0);
    });
});
