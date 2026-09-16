// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameAudioRuntimeFx } from "~/game-audio/fx/createGameAudioRuntimeFx";

class AudioHarness extends EventTarget {
	preload = "";
	crossOrigin: string | null = null;
	src = "";
	currentTime = 0;
	duration = 120;
	paused = true;
	readonly load = vi.fn();
	readonly play = vi.fn(async () => {
		this.paused = false;
		this.dispatchEvent(new Event("play"));
	});
	readonly pause = vi.fn(() => {
		this.paused = true;
		this.dispatchEvent(new Event("pause"));
	});
	readonly removeAttribute = vi.fn((name: string) => {
		if (name === "src") this.src = "";
	});
}

const gainNodeFn = () => ({
	connect: vi.fn(),
	disconnect: vi.fn(),
	gain: {
		value: 1,
		cancelScheduledValues: vi.fn(),
		linearRampToValueAtTime: vi.fn(),
		setValueAtTime: vi.fn(function (
			this: {
				value: number;
			},
			value: number,
		) {
			this.value = value;
		}),
	},
});

const createHarness = () => {
	const audios: AudioHarness[] = [];
	const gains: Array<ReturnType<typeof gainNodeFn>> = [];
	let state: AudioContextState = "suspended";
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
		currentTime: 2,
		destination: {},
		createGain: vi.fn(() => {
			const gain = gainNodeFn();
			gains.push(gain);
			return gain;
		}),
		createMediaElementSource: vi.fn(() => ({
			connect: vi.fn(),
		})),
		resume,
		close,
	} as unknown as AudioContext;
	const createContext = vi.fn(() => context);
	vi.stubGlobal(
		"Audio",
		vi.fn(function AudioMock() {
			const audio = new AudioHarness();
			audios.push(audio);
			return audio;
		}),
	);
	vi.stubGlobal(
		"AudioContext",
		vi.fn(function AudioContextMock() {
			return createContext();
		}),
	);
	return {
		audios,
		close,
		createContext,
		gains,
		resume,
	};
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("createGameAudioRuntimeFx", () => {
	it("streams Music only after unlock and applies the three mixer gains", async () => {
		const harness = createHarness();
		const runtime = Effect.runSync(
			createGameAudioRuntimeFx({
				game: {
					config: {
						music: {
							playlist: [
								"theme",
							],
						},
					},
					resources: [
						{
							id: "theme",
							type: "music",
						},
						{
							id: "item-theme",
							type: "music",
						},
					],
					getResourceUrlFn: (id) => `arkini://resource/${id}`,
				},
				maximumSfxVoices: 0,
				sound: {
					master: 80,
					music: 50,
					sfx: 25,
				},
			}),
		);

		expect(harness.createContext).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.prepareFx);
		expect(harness.audios).toHaveLength(2);
		expect(harness.audios.every(({ play }) => play.mock.calls.length === 0)).toBe(true);
		expect(
			harness.gains.slice(0, 3).map(({ gain }) => gain.setValueAtTime.mock.calls[0]?.[0]),
		).toEqual([
			80 / 100,
			50 / 100,
			25 / 100,
		]);

		await Effect.runPromise(runtime.unlockFx);
		expect(harness.resume).toHaveBeenCalledOnce();
		expect(harness.audios.filter(({ play }) => play.mock.calls.length === 1)).toHaveLength(1);
		expect(harness.audios.some(({ src }) => src === "arkini://resource/theme")).toBe(true);
		expect(harness.audios.some(({ src }) => src === "arkini://resource/item-theme")).toBe(
			false,
		);

		Effect.runSync(
			runtime.setSoundFx({
				master: 20,
				music: 30,
				sfx: 40,
			}),
		);
		expect(harness.gains[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, 2);
		expect(harness.gains[1]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.3, 2);
		expect(harness.gains[2]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.4, 2);

		await Effect.runPromise(runtime.closeFx);
		expect(harness.close).toHaveBeenCalledOnce();
	});

	it("streams packaged SFX through a fixed voice pool", async () => {
		const harness = createHarness();
		const runtime = Effect.runSync(
			createGameAudioRuntimeFx({
				game: {
					config: {
						sfx: {
							events: {
								"job:started": "custom-job-start",
							},
						},
					},
					resources: [
						{
							id: "custom-job-start",
							type: "sfx",
						},
					],
					getResourceUrlFn: (id) => `arkini://resource/${id}`,
				},
				maximumSfxVoices: 1,
				sound: {
					master: 100,
					music: 100,
					sfx: 100,
				},
			}),
		);
		await Effect.runPromise(runtime.unlockFx);

		await Effect.runPromise(
			runtime.playFx([
				{
					event: "job:started",
					strength: 1,
				},
				{
					event: "job:started",
					strength: 2,
				},
			]),
		);
		const sfx = harness.audios.find(({ preload }) => preload === "none");
		if (sfx === undefined) throw new Error("Expected one streamed SFX voice.");
		expect(sfx.src).toBe("arkini://resource/custom-job-start");
		expect(sfx.play).toHaveBeenCalledOnce();

		await Effect.runPromise(
			runtime.playFx([
				{
					event: "job:started",
					strength: 1,
				},
			]),
		);
		expect(sfx.play).toHaveBeenCalledOnce();

		sfx.dispatchEvent(new Event("ended"));
		await Effect.runPromise(
			runtime.playFx([
				{
					event: "job:started",
					strength: 1,
				},
			]),
		);
		expect(sfx.play).toHaveBeenCalledTimes(2);
		await Effect.runPromise(runtime.closeFx);
	});

	it("keeps unassigned gameplay events silent", async () => {
		const harness = createHarness();
		const runtime = Effect.runSync(
			createGameAudioRuntimeFx({
				game: {
					config: {
						sfx: {
							events: {},
						},
					},
					resources: [
						{
							id: "unused-sfx",
							type: "sfx",
						},
					],
					getResourceUrlFn: (id) => `arkini://resource/${id}`,
				},
				maximumSfxVoices: 1,
				sound: {
					master: 100,
					music: 100,
					sfx: 100,
				},
			}),
		);
		await Effect.runPromise(runtime.unlockFx);
		await Effect.runPromise(
			runtime.playFx([
				{
					event: "item:spawned",
					strength: 1,
				},
			]),
		);

		const sfx = harness.audios.find(({ preload }) => preload === "none");
		expect(sfx?.play).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("continues the random playlist when an incoming track ends during its crossfade", async () => {
		const harness = createHarness();
		const runtime = Effect.runSync(
			createGameAudioRuntimeFx({
				game: {
					config: {
						music: {
							playlist: [
								"theme-a",
								"theme-b",
							],
						},
					},
					resources: [
						{
							id: "theme-a",
							type: "music",
						},
						{
							id: "theme-b",
							type: "music",
						},
					],
					getResourceUrlFn: (id) => `arkini://resource/${id}`,
				},
				maximumSfxVoices: 0,
				sound: {
					master: 100,
					music: 100,
					sfx: 100,
				},
			}),
		);
		await Effect.runPromise(runtime.unlockFx);
		const first = harness.audios.find(({ play }) => play.mock.calls.length === 1);
		if (first === undefined) throw new Error("Expected the first Music slot.");
		first.currentTime = 119;
		first.dispatchEvent(new Event("timeupdate"));
		await Promise.resolve();
		const incoming = harness.audios.find(
			(audio) => audio !== first && audio.play.mock.calls.length === 1,
		);
		if (incoming === undefined) throw new Error("Expected the incoming Music slot.");

		incoming.dispatchEvent(new Event("ended"));
		await Promise.resolve();

		expect(harness.audios.reduce((sum, { play }) => sum + play.mock.calls.length, 0)).toBe(3);
		await Effect.runPromise(runtime.closeFx);
	});
});
