// @vitest-environment jsdom

import { Effect, Random } from "effect";
import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameAudioRuntimeFx } from "~/game-audio/fx/createGameAudioRuntimeFx";

class AudioHarness extends EventTarget {
	preload = "";
	crossOrigin: string | null = null;
	src = "";
	currentTime = 0;
	duration = 120;
	paused = true;
	readyState = 1;
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
	vi.useRealTimers();
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

describe("item detail music", () => {
	const setupFn = async () => {
		vi.useFakeTimers();
		const harness = createHarness();
		const runtime = Effect.runSync(
			createGameAudioRuntimeFx({
				game: {
					config: {
						music: {
							playlist: [
								"global",
							],
						},
					},
					resources: [
						"global",
						"detail-b",
						"detail-c",
					].map((id) => ({
						id,
						type: "music" as const,
					})),
					getResourceUrlFn: (id) => `arkini://resource/${id}`,
				},
				maximumSfxVoices: 0,
				sound: {
					master: 100,
					music: 100,
					sfx: 100,
				},
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.25,
						0.75,
						0.5,
						0.25,
					]),
				),
			),
		);
		await Effect.runPromise(runtime.unlockFx);
		return {
			harness,
			runtime,
		};
	};

	it("retains the global position across B to C and resumes it when the next detail has no music", async () => {
		const { harness, runtime } = await setupFn();
		const global = harness.audios.find((audio) => audio.src.endsWith("/global"))!;
		global.currentTime = 43;
		Effect.runSync(runtime.requestDetailMusicFx("detail-b"));
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(2000);
		expect(global.paused).toBe(true);
		const b = harness.audios.find((audio) => audio.src.endsWith("/detail-b"))!;
		expect(b.currentTime).toBeGreaterThanOrEqual(12);
		expect(b.currentTime).toBeLessThanOrEqual(108);
		Effect.runSync(runtime.requestDetailMusicFx("detail-b"));
		expect(b.play).toHaveBeenCalledOnce();
		Effect.runSync(runtime.requestDetailMusicFx("detail-c"));
		await Promise.resolve();
		expect(global.play).toHaveBeenCalledOnce();
		expect(
			harness.audios.some((audio) => audio.src.endsWith("/detail-c") && !audio.paused),
		).toBe(true);
		expect(
			harness.gains.some(({ gain }) =>
				gain.linearRampToValueAtTime.mock.calls.some(([value]) => value === 1),
			),
		).toBe(true);
		await vi.advanceTimersByTimeAsync(2000);
		Effect.runSync(runtime.requestDetailMusicFx(undefined));
		await Promise.resolve();
		expect(global.currentTime).toBe(43);
		expect(global.play).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(2000);
		expect(harness.audios.filter((audio) => !audio.paused)).toEqual([
			global,
		]);
		await Effect.runPromise(runtime.closeFx);
	});

	it("repeats the requested excerpt in another voice without advancing the global playlist", async () => {
		const { harness, runtime } = await setupFn();
		Effect.runSync(runtime.requestDetailMusicFx("detail-b"));
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(2000);
		const b = harness.audios.find((audio) => audio.src.endsWith("/detail-b"))!;
		b.currentTime = 119;
		b.dispatchEvent(new Event("timeupdate"));
		await Promise.resolve();
		const repeat = harness.audios.find(
			(audio) => audio !== b && audio.src.endsWith("/detail-b"),
		)!;
		expect(repeat).toBeDefined();
		expect(repeat.currentTime).toBeCloseTo(84);
		expect(repeat.play).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(2000);
		expect(b.paused).toBe(true);
		expect(
			harness.audios.find((audio) => audio.src.endsWith("/global"))?.play,
		).toHaveBeenCalledOnce();
		await Effect.runPromise(runtime.closeFx);
	});

	it("ignores stale metadata after leaving a detail and isolates playback failure", async () => {
		const { harness, runtime } = await setupFn();
		Effect.runSync(runtime.requestDetailMusicFx("detail-b"));
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(2000);
		const b = harness.audios.find((audio) => audio.src.endsWith("/detail-b"))!;
		const spare = harness.audios.find((audio, index) => index >= 2 && audio !== b)!;
		spare.readyState = 0;
		Effect.runSync(runtime.requestDetailMusicFx("detail-c"));
		Effect.runSync(runtime.requestDetailMusicFx(undefined));
		spare.dispatchEvent(new Event("loadedmetadata"));
		await Promise.resolve();
		expect(spare.play).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(2000);
		spare.readyState = 1;
		b.readyState = 1;
		b.play.mockRejectedValueOnce(new Error("decode failure"));
		Effect.runSync(runtime.requestDetailMusicFx("detail-b"));
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(2000);
		expect(harness.audios.find((audio) => audio.src.endsWith("/global"))?.paused).toBe(false);
		await Effect.runPromise(runtime.closeFx);
	});
});
