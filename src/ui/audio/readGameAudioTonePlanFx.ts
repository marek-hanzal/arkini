import { Effect } from "effect";
import { match } from "ts-pattern";

import type { readGameAudioCuesFx } from "~/ui/audio/readGameAudioCuesFx";

export namespace readGameAudioTonePlanFx {
	export interface Tone {
		readonly waveform: OscillatorType;
		readonly startFrequencyHz: number;
		readonly endFrequencyHz: number;
		readonly gain: number;
		readonly offsetSeconds: number;
		readonly durationSeconds: number;
	}

	export type Result = ReadonlyArray<Tone>;
}

const tone = (
	waveform: OscillatorType,
	startFrequencyHz: number,
	endFrequencyHz: number,
	durationSeconds: number,
	gain: number,
	offsetSeconds = 0,
): readGameAudioTonePlanFx.Tone => ({
	waveform,
	startFrequencyHz,
	endFrequencyHz,
	gain,
	offsetSeconds,
	durationSeconds,
});

/** Defines deterministic oscillator voices for one semantic game-audio cue. */
export const readGameAudioTonePlanFx = Effect.fn("readGameAudioTonePlanFx")(
	(cue: readGameAudioCuesFx.Result) =>
		Effect.sync((): readGameAudioTonePlanFx.Result => {
			const tones = match(cue.kind)
				.with("space-change", () => [
					tone("sine", 240, 360, 0.1, 0.1),
				])
				.with("job-start", () => [
					tone("triangle", 180, 260, 0.09, 0.11),
				])
				.with("job-complete", () => [
					tone("sine", 440, 520, 0.12, 0.12),
					tone("sine", 660, 780, 0.14, 0.1, 0.06),
				])
				.with("merge", () => [
					tone("triangle", 180, 120, 0.08, 0.12),
					tone("sine", 320, 460, 0.12, 0.1, 0.045),
				])
				.with("expire", () => [
					tone("sine", 260, 90, 0.16, 0.1),
				])
				.with("spawn", () => [
					tone("sine", 520, 760, 0.1, 0.09),
				])
				.with("place", () => [
					tone("triangle", 190, 140, 0.07, 0.11),
				])
				.with("stack", () => [
					tone("sine", 360, 480, 0.09, 0.1),
				])
				.with("split", () => [
					tone("triangle", 440, 300, 0.1, 0.09),
				])
				.with("consume", () => [
					tone("triangle", 260, 160, 0.09, 0.1),
				])
				.with("store", () => [
					tone("sine", 300, 420, 0.1, 0.09),
				])
				.with("charge", () => [
					tone("square", 160, 120, 0.06, 0.07),
				])
				.with("deplete", () => [
					tone("sawtooth", 180, 70, 0.15, 0.07),
				])
				.with("remove", () => [
					tone("sine", 160, 60, 0.12, 0.08),
				])
				.exhaustive();
			const strengthMultiplier = 0.7 + cue.strength * 0.1;

			return tones.map((candidate) => ({
				...candidate,
				gain: candidate.gain * strengthMultiplier,
			}));
		}),
);
