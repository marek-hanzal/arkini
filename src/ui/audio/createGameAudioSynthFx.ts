import { Effect } from "effect";

import type { readGameAudioCuesFx } from "~/ui/audio/readGameAudioCuesFx";
import { readGameAudioTonePlanFx } from "~/ui/audio/readGameAudioTonePlanFx";

export namespace createGameAudioSynthFx {
	export interface Props {
		readonly createContext?: () => AudioContext | null;
	}

	export interface Result {
		readonly unlockFx: Effect.Effect<void, unknown>;
		readonly playFx: (cues: ReadonlyArray<readGameAudioCuesFx.Result>) => Effect.Effect<void>;
		readonly closeFx: Effect.Effect<void, unknown>;
	}
}

const silentGain = 0.0001;
const cueGapSeconds = 0.02;
const scheduleLeadSeconds = 0.005;
const maximumScheduledAheadSeconds = 0.6;

const createBrowserAudioContext = (): AudioContext | null => {
	if (typeof window === "undefined" || window.AudioContext === undefined) return null;
	return new window.AudioContext({
		latencyHint: "interactive",
	});
};

/** Creates one lazy, package-lifetime Web Audio synthesizer capability. */
export const createGameAudioSynthFx = Effect.fn("createGameAudioSynthFx")(
	({ createContext = createBrowserAudioContext }: createGameAudioSynthFx.Props = {}) =>
		Effect.sync(() => {
			let disposed = false;
			let context: AudioContext | null = null;
			let output: GainNode | null = null;
			let scheduledThroughSeconds = 0;

			const closeProvisionalContextFx = (
				provisionalContext: AudioContext,
				provisionalOutput: GainNode | null,
			) =>
				Effect.tryPromise({
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
					catch: (cause) => cause,
				});

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
						nextContext = createContext();
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
					Effect.catchAll((cause) => {
						if (nextContext === null) return Effect.fail(cause);
						return closeProvisionalContextFx(nextContext, nextOutput).pipe(
							Effect.catchAll(() => Effect.void),
							Effect.zipRight(Effect.fail(cause)),
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

			const playFx: createGameAudioSynthFx.Result["playFx"] = (cues) =>
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
							readGameAudioTonePlanFx(cue).pipe(
								Effect.tap((tones) =>
									Effect.sync(() => {
										for (const tone of tones) {
											try {
												const startAt =
													batchStart +
													cueCursorSeconds +
													tone.offsetSeconds;
												const attackAt =
													startAt +
													Math.min(0.008, tone.durationSeconds / 3);
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
								),
							),
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
				});

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
				unlockFx,
				playFx,
				closeFx,
			} satisfies createGameAudioSynthFx.Result;
		}),
);
