import { VideoInput, PipelineStep, Result, ErrorCode } from '../types.js';
import { pipeline } from './pipeline.js';
import { ok, err } from '../utils/result.js';

export async function batch(inputs: VideoInput[], steps: PipelineStep[], options?: { concurrency?: number }): Promise<Result<Buffer[]>> {
    const limit = options?.concurrency || 4;
    const results: Buffer[] = [];
    const errors: string[] = [];
    let currentIndex = 0;

    const worker = async () => {
        while (currentIndex < inputs.length) {
            const i = currentIndex++;
            const input = inputs[i];
            
            try {
                const result = await pipeline(input, steps);
                if (result.ok) {
                    results[i] = result.data;
                } else {
                    errors.push(`Input ${i} failed: ${result.error}`);
                }
            } catch (e: any) {
                errors.push(`Input ${i} threw: ${e.message}`);
            }
        }
    };

    const workers = [];
    for (let i = 0; i < limit; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);

    if (errors.length > 0) {
        return err(ErrorCode.PROCESSING_FAILED, `Batch processing had errors:\n${errors.join('\n')}`);
    }

    return ok(results);
}
