import { Effect } from "effect";
import { match } from "ts-pattern";

import type { readGameAudioCuesFn } from "~/game-audio/fn/readGameAudioCuesFn";

interface Tone {
	readonly waveform: OscillatorType;
	readonly startFrequencyHz: number;
	readonly endFrequencyHz: number;
	readonly gain: number;
	readonly offsetSeconds: number;
	readonly durationSeconds: number;
}

const toneFn = (
	waveform: OscillatorType,
	startFrequencyHz: number,
	endFrequencyHz: number,
	durationSeconds: number,
	gain: number,
	offsetSeconds = 0,
): Tone => ({
	waveform,
	startFrequencyHz,
	endFrequencyHz,
	gain,
	offsetSeconds,
	durationSeconds,
});

const readGameAudioTonePlanFn = (cue: readGameAudioCuesFn.Result): ReadonlyArray<Tone> => {
	const tones = match(cue.kind)
		.with("space-change", () => [
			toneFn("sine", 240, 360, 0.1, 0.1),
		])
		.with("job-start", () => [
			toneFn("triangle", 180, 260, 0.09, 0.11),
		])
		.with("job-complete", () => [
			toneFn("sine", 440, 520, 0.12, 0.12),
			toneFn("sine", 660, 780, 0.14, 0.1, 0.06),
		])
		.with("merge", () => [
			toneFn("triangle", 180, 120, 0.08, 0.12),
			toneFn("sine", 320, 460, 0.12, 0.1, 0.045),
		])
		.with("expire", () => [
			toneFn("sine", 260, 90, 0.16, 0.1),
		])
		.with("spawn", () => [
			toneFn("sine", 520, 760, 0.1, 0.09),
		])
		.with("place", () => [
			toneFn("triangle", 190, 140, 0.07, 0.11),
		])
		.with("stack", () => [
			toneFn("sine", 360, 480, 0.09, 0.1),
		])
		.with("split", () => [
			toneFn("triangle", 440, 300, 0.1, 0.09),
		])
		.with("consume", () => [
			toneFn("triangle", 260, 160, 0.09, 0.1),
		])
		.with("store", () => [
			toneFn("sine", 300, 420, 0.1, 0.09),
		])
		.with("charge", () => [
			toneFn("square", 160, 120, 0.06, 0.07),
		])
		.with("deplete", () => [
			toneFn("sawtooth", 180, 70, 0.15, 0.07),
		])
		.with("remove", () => [
			toneFn("sine", 160, 60, 0.12, 0.08),
		])
		.exhaustive();
	const strengthMultiplier = 0.7 + cue.strength * 0.1;

	return tones.map((candidate) => ({
		...candidate,
		gain: candidate.gain * strengthMultiplier,
	}));
};

export namespace createGameAudioSynthFx {
	export interface Result {
		readonly prepareFx: Effect.Effect<void, unknown, never>;
		readonly unlockFx: Effect.Effect<void, unknown, never>;
		readonly playFx: (
			cues: ReadonlyArray<readGameAudioCuesFn.Result>,
		) => Effect.Effect<void, never, never>;
		readonly closeFx: Effect.Effect<void, unknown, never>;
	}
}

const silentGain = 0.0001;
const cueGapSeconds = 0.02;
const scheduleLeadSeconds = 0.005;
const maximumScheduledAheadSeconds = 0.6;

const createBrowserAudioContextFn = (): AudioContext | null => {
	if (typeof window === "undefined" || window.AudioContext === undefined) return null;
	return new window.AudioContext({
		latencyHint: "interactive",
	});
};

/** Creates one lazy, package-lifetime Web Audio synthesizer capability. */
export const createGameAudioSynthFx = Effect.fn("createGameAudioSynthFx")(() =>
	Effect.sync(() => {
		let disposed = false;
		let context: AudioContext | null = null;
		let output: GainNode | null = null;
		let scheduledThroughSeconds = 0;

		const ensureContextFx = Effect.suspend(() => {
			if (disposed) return Effect.succeed(null);
			if (context !== null && output !== null) {
				return Effect.succeed({
					context,
					output,
				});
			}
			let nextContext: AudioContext | null = null;
			let nextOutput: GainNode | null = null;

			return Effect.try({
				try: () => {
					nextContext = createBrowserAudioContextFn();
					if (nextContext === null) return null;
					nextOutput = nextContext.createGain();
					nextOutput.gain.setValueAtTime(0.14, nextContext.currentTime);
					nextOutput.connect(nextContext.destination);
					context = nextContext;
					output = nextOutput;
					scheduledThroughSeconds = nextContext.currentTime;
					return {
						context: nextContext,
						output: nextOutput,
					};
				},
				catch: (cause) => cause,
			}).pipe(
				Effect.catch((cause) => {
					if (nextContext === null) return Effect.fail(cause);
					const provisionalContext = nextContext;
					const provisionalOutput = nextOutput;
					return Effect.tryPromise({
						try: async () => {
							try {
								provisionalOutput?.disconnect();
							} catch {
								// Context closure below remains the authoritative resource cleanup.
							}
							try {
								if (provisionalContext.state !== "closed") {
									await provisionalContext.close();
								}
							} catch {
								// Preserve the initialization failure that made this context unusable.
							}
						},
						catch: (cleanupCause) => cleanupCause,
					}).pipe(
						Effect.catch(() => Effect.void),
						Effect.andThen(Effect.fail(cause)),
					);
				}),
			);
		});

		const unlockFx = ensureContextFx.pipe(
			Effect.flatMap((graph) => {
				if (graph === null || graph.context.state !== "suspended") {
					return Effect.void;
				}
				return Effect.tryPromise({
					try: () => graph.context.resume(),
					catch: (cause) => cause,
				});
			}),
		);
		const prepareFx = ensureContextFx.pipe(Effect.asVoid);

		const playFx: createGameAudioSynthFx.Result["playFx"] = Effect.fn("GameAudioSynth.playFx")(
			(cues) =>
				Effect.suspend(() => {
					const activeContext = context;
					const activeOutput = output;
					if (
						disposed ||
						activeContext === null ||
						activeOutput === null ||
						activeContext.state !== "running"
					) {
						return Effect.void;
					}
					if (
						scheduledThroughSeconds - activeContext.currentTime >
						maximumScheduledAheadSeconds
					) {
						return Effect.void;
					}
					const batchStart = Math.max(
						activeContext.currentTime + scheduleLeadSeconds,
						scheduledThroughSeconds,
					);
					let cueCursorSeconds = 0;

					return Effect.forEach(
						cues,
						(cue) =>
							Effect.sync(() => {
								const tones = readGameAudioTonePlanFn(cue);
								for (const tone of tones) {
									try {
										const startAt =
											batchStart + cueCursorSeconds + tone.offsetSeconds;
										const attackAt =
											startAt + Math.min(0.008, tone.durationSeconds / 3);
										const stopAt = startAt + tone.durationSeconds;
										const oscillator = activeContext.createOscillator();
										const envelope = activeContext.createGain();
										oscillator.type = tone.waveform;
										oscillator.frequency.setValueAtTime(
											tone.startFrequencyHz,
											startAt,
										);
										oscillator.frequency.exponentialRampToValueAtTime(
											tone.endFrequencyHz,
											stopAt,
										);
										envelope.gain.setValueAtTime(silentGain, startAt);
										envelope.gain.exponentialRampToValueAtTime(
											tone.gain,
											attackAt,
										);
										envelope.gain.exponentialRampToValueAtTime(
											silentGain,
											stopAt,
										);
										oscillator.connect(envelope);
										envelope.connect(activeOutput);
										oscillator.addEventListener(
											"ended",
											() => {
												oscillator.disconnect();
												envelope.disconnect();
											},
											{
												once: true,
											},
										);
										oscillator.start(startAt);
										oscillator.stop(stopAt + scheduleLeadSeconds);
									} catch {
										// One failed voice cannot block another cue or gameplay.
									}
								}
								const cueDurationSeconds = tones.reduce(
									(duration, tone) =>
										Math.max(
											duration,
											tone.offsetSeconds + tone.durationSeconds,
										),
									0,
								);
								cueCursorSeconds += cueDurationSeconds + cueGapSeconds;
							}),
						{
							discard: true,
						},
					).pipe(
						Effect.tap(() =>
							Effect.sync(() => {
								scheduledThroughSeconds = batchStart + cueCursorSeconds;
							}),
						),
					);
				}),
		);

		const closeFx = Effect.tryPromise({
			try: async () => {
				if (disposed) return;
				disposed = true;
				const closingContext = context;
				const closingOutput = output;
				context = null;
				output = null;
				scheduledThroughSeconds = 0;
				try {
					closingOutput?.disconnect();
				} finally {
					if (closingContext !== null && closingContext.state !== "closed") {
						await closingContext.close();
					}
				}
			},
			catch: (cause) => cause,
		});

		return {
			prepareFx,
			unlockFx,
			playFx,
			closeFx,
		} satisfies createGameAudioSynthFx.Result;
	}),
);
