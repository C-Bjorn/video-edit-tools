import { VideoInput, PipelineStep, Result, ErrorCode } from '../types.js';
import { trim } from './trim.js';
import { concat } from './concat.js';
import { resize } from './resize.js';
import { crop } from './crop.js';
import { changeSpeed } from './change-speed.js';
import { addText } from './add-text.js';
import { addSubtitles } from './add-subtitles.js';
import { composite } from './composite.js';
import { gradientOverlay } from './gradient-overlay.js';
import { adjust } from './adjust.js';
import { applyFilter } from './apply-filter.js';
import { replaceAudio } from './replace-audio.js';
import { adjustVolume } from './adjust-volume.js';
import { convert } from './convert.js';
import { generateThumbnail } from './generate-thumbnail.js';
import { ok, err } from '../utils/result.js';

export async function pipeline(input: VideoInput, steps: PipelineStep[]): Promise<Result<Buffer>> {
    let currentInput: VideoInput = input;
    const warnings: string[] = [];

    for (const step of steps) {
        let result: Result<any>;

        switch (step.op) {
            case 'trim':
                result = await trim(currentInput, step);
                break;
            case 'concat':
                // concat takes an array of inputs, the first is usually the currentInput.
                // Assuming step.inputs includes the current input if they want to concat others to it.
                // Or maybe the first input is `currentInput` and `step.inputs` are the rest?
                // The spec says: { op: 'concat', inputs: VideoInput[] }.
                result = await concat([currentInput, ...step.inputs], step);
                break;
            case 'resize':
                result = await resize(currentInput, step);
                break;
            case 'crop':
                result = await crop(currentInput, step);
                break;
            case 'changeSpeed':
                result = await changeSpeed(currentInput, step);
                break;
            case 'addText':
                result = await addText(currentInput, step);
                break;
            case 'addSubtitles':
                result = await addSubtitles(currentInput, step);
                break;
            case 'composite':
                result = await composite(currentInput, step);
                break;
            case 'gradientOverlay':
                result = await gradientOverlay(currentInput, step);
                break;
            case 'adjust':
                result = await adjust(currentInput, step);
                break;
            case 'applyFilter':
                result = await applyFilter(currentInput, step);
                break;
            case 'replaceAudio':
                result = await replaceAudio(currentInput, step);
                break;
            case 'adjustVolume':
                result = await adjustVolume(currentInput, step);
                break;
            case 'convert':
                result = await convert(currentInput, step);
                break;
            case 'generateThumbnail':
                result = await generateThumbnail(currentInput, step);
                break;
            default:
                return err(ErrorCode.INVALID_INPUT, `Unknown pipeline op: ${(step as any).op}`);
        }

        if (!result.ok) {
            return err(result.code, `Pipeline failed at step ${step.op}: ${result.error}`);
        }

        if (result.warnings) {
            warnings.push(...result.warnings);
        }

        // Output of each step becomes the input of the next.
        // Even generateThumbnail returns Buffer, so it technically breaks the video flow if next step expects video.
        // It's up to the caller to use generateThumbnail only at the end.
        currentInput = Array.isArray(result.data) ? result.data[0] : result.data;
    }

    if (!Buffer.isBuffer(currentInput)) {
        return err(ErrorCode.PROCESSING_FAILED, 'Pipeline did not yield a Buffer at the end');
    }

    return ok(currentInput, warnings);
}
