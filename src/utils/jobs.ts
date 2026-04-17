export type JobStatus = 'processing' | 'done' | 'error' | 'cancelled';

export interface JobRecord {
    status: JobStatus;
    savedTo?: string;
    error?: string;
    /** Internal — do not serialize to callers. Call via cancelJob(). */
    cancel?: () => void;
}

const jobs = new Map<string, JobRecord>();

/** Create a new job in `processing` state and return its UUID. */
export function createJob(): string {
    const id = crypto.randomUUID();
    jobs.set(id, { status: 'processing' });
    return id;
}

/** Register a cancellation callback for a job (e.g. Worker.terminate). */
export function setCancelFn(id: string, fn: () => void): void {
    const record = jobs.get(id);
    if (record && record.status === 'processing') record.cancel = fn;
}

/** Mark a job as successfully completed. No-op if already cancelled. */
export function resolveJob(id: string, savedTo: string): void {
    const record = jobs.get(id);
    if (!record || record.status === 'cancelled') return;
    jobs.set(id, { status: 'done', savedTo });
}

/** Mark a job as failed with an error message. No-op if already cancelled. */
export function failJob(id: string, error: string): void {
    const record = jobs.get(id);
    if (!record || record.status === 'cancelled') return;
    jobs.set(id, { status: 'error', error });
}

/**
 * Cancel a job. Calls the registered cancel callback (e.g. Worker.terminate),
 * then marks the job as cancelled.
 * Returns false if the job doesn't exist or is already complete/cancelled.
 */
export function cancelJob(id: string): boolean {
    const record = jobs.get(id);
    if (!record) return false;
    if (record.status === 'done' || record.status === 'error' || record.status === 'cancelled') return false;
    if (record.cancel) record.cancel();
    jobs.set(id, { status: 'cancelled' });
    return true;
}

/** Look up a job by ID. Returns undefined if no such job exists. */
export function getJob(id: string): JobRecord | undefined {
    return jobs.get(id);
}
