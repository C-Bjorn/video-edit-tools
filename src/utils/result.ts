import { Result, ErrorCode } from '../types.js';

export function ok<T>(data: T, warnings?: string[]): Result<T> {
  return warnings && warnings.length > 0 ? { ok: true, data, warnings } : { ok: true, data };
}

export function err<T>(code: ErrorCode, error: string): Result<T> {
  return { ok: false, code, error };
}
