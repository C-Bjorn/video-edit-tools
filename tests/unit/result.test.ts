import { describe, it, expect } from 'vitest';
import { ok, err } from '../../src/utils/result.js';
import { ErrorCode } from '../../src/types.js';

describe('result', () => {
    it('creates ok payload', () => {
        const res = ok({ value: 1 });
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.data.value).toBe(1);
            expect(res.warnings).toBeUndefined();
        }
    });

    it('creates ok payload with warnings', () => {
        const res = ok({ value: 2 }, ['warning msg']);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.data.value).toBe(2);
            expect(res.warnings).toEqual(['warning msg']);
        }
    });

    it('creates err payload', () => {
        const res = err(ErrorCode.INVALID_INPUT, 'Bad input');
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.code).toBe(ErrorCode.INVALID_INPUT);
            expect(res.error).toBe('Bad input');
        }
    });
});
