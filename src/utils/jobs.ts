export type JobStatus = 'processing' | 'done' | 'error';

export interface JobRecord {
    status: JobStatus;
    savedTo?: string;
    error?: string;
}

const jobs = new Map<string, JobRecord>();

/** Create a new job in `processing` state and return its UUID. */
export function createJob(): string {
    const id = crypto.randomUUID();
    jobs.set(id, { status: 'processing' });
    return id;
}

/** Mark a job as successfully completed with a saved output path. */
export function resolveJob(id: string, savedTo: string): void {
    jobs.set(id, { status: 'done', savedTo });
}

/** Mark a job as failed with an error message. */
export function failJob(id: string, error: string): void {
    jobs.set(id, { status: 'error', error });
}

/** Look up a job by ID. Returns undefined if no such job exists. */
export function getJob(id: string): JobRecord | undefined {
    return jobs.get(id);
}
