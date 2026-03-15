import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { generateTmpFilePath, cleanupTmpFile, withTmpFile } from '../../src/utils/tmp.js';

describe('tmp file management', () => {
    let createdFiles: string[] = [];

    afterEach(async () => {
        for (const f of createdFiles) {
            await cleanupTmpFile(f);
        }
        createdFiles = [];
    });

    it('generates unique file paths in tmp dir with correct extension', () => {
        const path1 = generateTmpFilePath('mp4');
        const path2 = generateTmpFilePath('.mp4');
        createdFiles.push(path1, path2);

        expect(path1).toMatch(/vet-.*\.mp4$/);
        expect(path2).toMatch(/vet-.*\.mp4$/);
        expect(path1).not.toBe(path2);
    });

    it('creates and cleans up files with withTmpFile when given a Buffer', async () => {
        const buf = Buffer.from('hello world');
        let pathInside = '';

        const res = await withTmpFile(buf, 'txt', async (filePath) => {
            pathInside = filePath;
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('hello world');
            return 'success';
        });

        expect(res).toBe('success');
        
        // Ensure file is deleted after
        await expect(fs.access(pathInside)).rejects.toThrow();
    });

    it('does not create or delete files when given a string path', async () => {
        const fakePath = '/my/fake/file.mp4';

        const res = await withTmpFile(fakePath, 'mp4', async (filePath) => {
            expect(filePath).toBe(fakePath);
            return 'success_string';
        });

        expect(res).toBe('success_string');
    });
});
