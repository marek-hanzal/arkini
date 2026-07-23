import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createGameAudioSynthFx } from "~/ui/audio/createGameAudioSynthFx";

interface HarnessOptions {
	readonly outputConnectError?: Error;
	readonly outputDisconnectError?: Error;
}

const createHarness = ({ outputConnectError, outputDisconnectError }: HarnessOptions = {}) => {
	let state: AudioContextState = "suspended";
	const gainNodes: Array<{
		readonly connect: ReturnType<typeof vi.fn>;
		readonly disconnect: ReturnType<typeof vi.fn>;
		readonly gain: {
			readonly setValueAtTime: ReturnType<typeof vi.fn>;
			readonly exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
		};
	}> = [];
	const oscillators: Array<{
		readonly addEventListener: ReturnType<typeof vi.fn>;
		readonly connect: ReturnType<typeof vi.fn>;
		readonly disconnect: ReturnType<typeof vi.fn>;
		readonly frequency: {
			readonly setValueAtTime: ReturnType<typeof vi.fn>;
			readonly exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
		};
		readonly start: ReturnType<typeof vi.fn>;
		readonly stop: ReturnType<typeof vi.fn>;
		type: OscillatorType;
	}> = [];
	const resume = vi.fn(async () => {
		state = "running";
	});
	const close = vi.fn(async () => {
		state = "closed";
	});
	const context = {
		get state() {
			return state;
		},
		currentTime: 4,
		destination: {},
		createGain: vi.fn(() => {
			const isOutput = gainNodes.length === 0;
			const node = {
				connect: vi.fn(() => {
					if (isOutput && outputConnectError !== undefined) {
						throw outputConnectError;
					}
				}),
				disconnect: vi.fn(() => {
					if (isOutput && outputDisconnectError !== undefined) {
						throw outputDisconnectError;
					}
				}),
				gain: {
					setValueAtTime: vi.fn(),
					exponentialRampToValueAtTime: vi.fn(),
				},
			};
			gainNodes.push(node);
			return node;
		}),
		createOscillator: vi.fn(() => {
			const node = {
				addEventListener: vi.fn(),
				connect: vi.fn(),
				disconnect: vi.fn(),
				frequency: {
					setValueAtTime: vi.fn(),
					exponentialRampToValueAtTime: vi.fn(),
				},
				start: vi.fn(),
				stop: vi.fn(),
				type: "sine" as OscillatorType,
			};
			oscillators.push(node);
			return node;
		}),
		resume,
		close,
	} as unknown as AudioContext;
	const createContext = vi.fn(() => context);

	return {
		close,
		context,
		createContext,
		gainNodes,
		oscillators,
		resume,
	};
};

describe("createGameAudioSynthFx", () => {
	it("creates no browser resources before unlock and drops locked playback", async () => {
		const harness = createHarness();
		const synth = Effect.runSync(
			createGameAudioSynthFx({
				createContext: harness.createContext,
			}),
		);
		const cues = [
			{
				kind: "job-complete" as const,
				strength: 2,
			},
		];

		Effect.runSync(synth.playFx(cues));
		expect(harness.createContext).not.toHaveBeenCalled();

		await Effect.runPromise(synth.unlockFx);
		expect(harness.createContext).toHaveBeenCalledOnce();
		expect(harness.resume).toHaveBeenCalledOnce();
		expect(harness.gainNodes).toHaveLength(1);

		Effect.runSync(synth.playFx(cues));
		expect(harness.oscillators).toHaveLength(2);
		expect(harness.oscillators.every(({ start }) => start.mock.calls.length === 1)).toBe(true);
		expect(harness.oscillators.every(({ stop }) => stop.mock.calls.length === 1)).toBe(true);

		await Effect.runPromise(synth.closeFx);
		expect(harness.gainNodes[0]?.disconnect).toHaveBeenCalledOnce();
		expect(harness.close).toHaveBeenCalledOnce();

		await Effect.runPromise(synth.unlockFx);
		expect(harness.createContext).toHaveBeenCalledOnce();
	});

	it("serializes batches on the AudioContext clock and drops excessive backlog", async () => {
		const harness = createHarness();
		const synth = Effect.runSync(
			createGameAudioSynthFx({
				createContext: harness.createContext,
			}),
		);
		const completionCue = [
			{
				kind: "job-complete" as const,
				strength: 2,
			},
		];

		await Effect.runPromise(synth.unlockFx);
		Effect.runSync(synth.playFx(completionCue));
		Effect.runSync(synth.playFx(completionCue));

		const firstBatchLastToneEnd =
			harness.oscillators[1]?.frequency.exponentialRampToValueAtTime.mock.calls[0]?.[1];
		const secondBatchFirstToneStart = harness.oscillators[2]?.start.mock.calls[0]?.[0];
		expect(firstBatchLastToneEnd).toBeTypeOf("number");
		expect(secondBatchFirstToneStart).toBeTypeOf("number");
		expect(secondBatchFirstToneStart).toBeGreaterThan(firstBatchLastToneEnd);

		Effect.runSync(synth.playFx(completionCue));
		expect(harness.oscillators).toHaveLength(6);
		Effect.runSync(synth.playFx(completionCue));
		expect(harness.oscillators).toHaveLength(6);

		await Effect.runPromise(synth.closeFx);
	});

	it("closes a provisional context when graph initialization fails", async () => {
		const connectError = new Error("output connect failed");
		const harness = createHarness({
			outputConnectError: connectError,
		});
		const synth = Effect.runSync(
			createGameAudioSynthFx({
				createContext: harness.createContext,
			}),
		);

		await expect(Effect.runPromise(synth.unlockFx)).rejects.toThrow(connectError.message);
		expect(harness.gainNodes[0]?.disconnect).toHaveBeenCalledOnce();
		expect(harness.close).toHaveBeenCalledOnce();

		await Effect.runPromise(synth.closeFx);
	});

	it("closes the AudioContext even when output disposal fails", async () => {
		const disconnectError = new Error("output disconnect failed");
		const harness = createHarness({
			outputDisconnectError: disconnectError,
		});
		const synth = Effect.runSync(
			createGameAudioSynthFx({
				createContext: harness.createContext,
			}),
		);

		await Effect.runPromise(synth.unlockFx);
		await expect(Effect.runPromise(synth.closeFx)).rejects.toThrow(disconnectError.message);
		expect(harness.close).toHaveBeenCalledOnce();
	});
});
