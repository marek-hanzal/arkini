// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Cause, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	type ReactNode,
	StrictMode,
	Suspense,
	act,
	createElement,
	startTransition,
	useEffect,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { createGameAudioRuntimeFx } from "~/game-audio/fx/createGameAudioRuntimeFx";
import type { GameAudioControl } from "~/game-audio/context/GameAudioContext";
import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";

const eventState = vi.hoisted(() => ({
	game: {
		id: "game:first",
		config: {
			items: {},
		},
	},
	listener: null as ((batch: GameEventBatchSchema.Type) => void | PromiseLike<void>) | null,
}));

vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => eventState.game,
}));

vi.mock("~/game-presentation/ui/useGameEvents", async (importOriginal) => ({
	...(await importOriginal()),
	useGameEvents: (listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>) => {
		eventState.listener = listener;
	},
}));

const createGameAudioRuntimeFxMock = vi.hoisted(() => vi.fn());

vi.mock("~/game-audio/fx/createGameAudioRuntimeFx", () => ({
	createGameAudioRuntimeFx: () => createGameAudioRuntimeFxMock(),
}));

import { GameAudio } from "~/game-audio/ui/GameAudio";
import { useGameAudioControl } from "~/game-audio/ui/useGameAudioControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

const createAudioHarness = ({
	closeFx,
	playFx,
	prepareFx,
	unlockFx,
}: {
	readonly closeFx?: Effect.Effect<void, unknown>;
	readonly playFx?: createGameAudioRuntimeFx.Result["playFx"];
	readonly prepareFx?: Effect.Effect<void, unknown>;
	readonly unlockFx?: Effect.Effect<void, unknown>;
} = {}) => {
	const prepare = vi.fn();
	const unlock = vi.fn();
	const play = vi.fn();
	const setSound = vi.fn();
	const requestDetailMusic = vi.fn();
	const close = vi.fn();
	const audio = {
		prepareFx: prepareFx ?? Effect.sync(() => prepare()),
		unlockFx: unlockFx ?? Effect.sync(() => unlock()),
		playFx: playFx ?? ((cues) => Effect.sync(() => play(cues))),
		playMusicFx: () => Effect.void,
		requestDetailMusicFx: (resourceId) => Effect.sync(() => requestDetailMusic(resourceId)),
		setSoundFx: (sound) => Effect.sync(() => setSound(sound)),
		closeFx: closeFx ?? Effect.sync(() => close()),
	} satisfies createGameAudioRuntimeFx.Result;

	return {
		close,
		play,
		prepare,
		setSound,
		requestDetailMusic,
		audio,
		unlock,
	};
};

const jobStartedBatch = {
	events: [
		{
			type: GameEventEnumSchema.enum.JobStarted,
			jobId: "job:1",
			ownerItemId: "runtime:producer",
			lineId: "line:1",
		},
	],
} satisfies GameEventBatchSchema.Type;

const jobCompletedBatch = {
	events: [
		{
			type: GameEventEnumSchema.enum.JobCompleted,
			jobId: "job:2",
			ownerItemId: "runtime:producer",
			lineId: "line:1",
		},
	],
} satisfies GameEventBatchSchema.Type;

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const AudioControlProbe = ({
	onControlFn,
}: {
	readonly onControlFn: (control: GameAudioControl) => void;
}) => {
	const control = useGameAudioControl();
	useEffect(
		() => onControlFn(control),
		[
			control,
			onControlFn,
		],
	);
	return null;
};

const renderAudio = async ({
	children,
	registry = makeRegistry(),
	strict = false,
}: {
	readonly children?: ReactNode;
	readonly registry?: AtomRegistry.AtomRegistry;
	readonly strict?: boolean;
} = {}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = () =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				strict
					? createElement(StrictMode, null, createElement(GameAudio, null, children))
					: createElement(GameAudio, null, children),
			),
		);
	await act(async () => render());
	return {
		registry,
		render,
		root,
	};
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	eventState.game = {
		id: "game:first",
		config: {
			items: {},
		},
	};
	eventState.listener = null;
	document.body.replaceChildren();
	createGameAudioRuntimeFxMock.mockReset();
	vi.restoreAllMocks();
});

describe("GameAudio", () => {
	it("optimistically unlocks on mount, retries from local input, and plays transient event batches", async () => {
		const harness = createAudioHarness();
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		const { root } = await renderAudio();
		expect(createGameAudioRuntimeFxMock).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(harness.prepare).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(harness.unlock).toHaveBeenCalledOnce());

		window.dispatchEvent(new Event("pointerdown"));
		await vi.waitFor(() => expect(harness.unlock).toHaveBeenCalledTimes(2));

		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		await vi.waitFor(() =>
			expect(harness.play).toHaveBeenCalledWith([
				{
					event: GameEventEnumSchema.enum.JobStarted,
					strength: 1,
				},
			]),
		);

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await vi.waitFor(() => expect(harness.close).toHaveBeenCalledOnce());
	});

	it("routes direct presentation SFX through the same bounded audio runtime", async () => {
		const harness = createAudioHarness();
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		let control: GameAudioControl | undefined;
		await renderAudio({
			children: createElement(AudioControlProbe, {
				onControlFn: (next) => {
					control = next;
				},
			}),
		});
		if (control === undefined) throw new Error("Missing Game audio control.");

		control.playSfxEventFn(PresentationSfxEventEnumSchema.enum.ItemDetailOpened);

		await vi.waitFor(() =>
			expect(harness.play).toHaveBeenCalledWith([
				{
					event: PresentationSfxEventEnumSchema.enum.ItemDetailOpened,
					strength: 1,
				},
			]),
		);
	});

	it("routes detail music changes and ignores the stale control after unmount", async () => {
		const harness = createAudioHarness();
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		let control: GameAudioControl | undefined;
		const { root } = await renderAudio({
			children: createElement(AudioControlProbe, {
				onControlFn: (next) => {
					control = next;
				},
			}),
		});
		if (control === undefined) throw new Error("Missing Game audio control.");
		control.requestDetailMusicFn("b");
		await vi.waitFor(() => expect(harness.requestDetailMusic).toHaveBeenLastCalledWith("b"));
		control.requestDetailMusicFn("c");
		await vi.waitFor(() => expect(harness.requestDetailMusic).toHaveBeenLastCalledWith("c"));
		control.requestDetailMusicFn(undefined);
		await vi.waitFor(() =>
			expect(harness.requestDetailMusic).toHaveBeenLastCalledWith(undefined),
		);
		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		control.requestDetailMusicFn("stale");
		expect(harness.requestDetailMusic).toHaveBeenCalledTimes(3);
	});

	it("does not lose synchronously settling unlocks or ordered event batches", async () => {
		const harness = createAudioHarness();
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		await renderAudio();

		window.dispatchEvent(new Event("pointerdown"));
		window.dispatchEvent(new Event("keydown"));
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		listener(jobCompletedBatch);

		await vi.waitFor(() => {
			expect(harness.unlock).toHaveBeenCalledTimes(3);
			expect(harness.play).toHaveBeenCalledTimes(2);
		});
		expect(harness.play.mock.calls.map(([cues]) => cues[0]?.event)).toEqual([
			GameEventEnumSchema.enum.JobStarted,
			GameEventEnumSchema.enum.JobCompleted,
		]);
	});

	it("replaces the exact Game resource, closes the old audio, and routes later batches only to the new audio", async () => {
		const first = createAudioHarness();
		const second = createAudioHarness();
		const synths = [
			first.audio,
			second.audio,
		];
		let synthIndex = 0;
		createGameAudioRuntimeFxMock.mockImplementation(() =>
			Effect.succeed(synths[synthIndex++] ?? second.audio),
		);
		const { render } = await renderAudio();

		eventState.game = {
			id: "game:second",
			config: {
				items: {},
			},
		};
		await act(async () => render());

		await vi.waitFor(() => expect(first.close).toHaveBeenCalledOnce());
		expect(createGameAudioRuntimeFxMock).toHaveBeenCalledTimes(2);

		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobCompletedBatch);
		await vi.waitFor(() => expect(second.play).toHaveBeenCalledOnce());
		expect(first.play).not.toHaveBeenCalled();
	});

	it("ignores a stale event callback after replacing the Game identity", async () => {
		const first = createAudioHarness();
		const second = createAudioHarness();
		const synths = [
			first.audio,
			second.audio,
		];
		let synthIndex = 0;
		createGameAudioRuntimeFxMock.mockImplementation(() =>
			Effect.succeed(synths[synthIndex++] ?? second.audio),
		);
		const { render } = await renderAudio();
		const staleListener = eventState.listener;
		if (staleListener === null) throw new Error("Missing first game audio event listener.");

		eventState.game = {
			id: "game:second",
			config: {
				items: {},
			},
		};
		await act(async () => render());
		await vi.waitFor(() => expect(first.close).toHaveBeenCalledOnce());

		staleListener(jobStartedBatch);
		await Promise.resolve();
		expect(first.play).not.toHaveBeenCalled();
		expect(second.play).not.toHaveBeenCalled();

		const currentListener = eventState.listener;
		if (currentListener === null) throw new Error("Missing second game audio event listener.");
		currentListener(jobStartedBatch);
		await vi.waitFor(() => expect(second.play).toHaveBeenCalledOnce());
	});

	it("keeps the committed audio owner during an abandoned concurrent render", async () => {
		const committed = createAudioHarness();
		const abandoned = createAudioHarness();
		const synths = [
			committed.audio,
			abandoned.audio,
		];
		let synthIndex = 0;
		createGameAudioRuntimeFxMock.mockImplementation(() =>
			Effect.succeed(synths[synthIndex++] ?? abandoned.audio),
		);
		const never = new Promise<void>(() => undefined);
		const SuspendOnDemand = ({ suspend }: { readonly suspend: boolean }) => {
			if (suspend) throw never;
			return null;
		};
		const registry = makeRegistry();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(
						Suspense,
						{
							fallback: null,
						},
						createElement(GameAudio),
						createElement(SuspendOnDemand, {
							suspend: false,
						}),
					),
				),
			);
		});
		const committedListener = eventState.listener;
		if (committedListener === null) throw new Error("Missing committed audio event listener.");

		eventState.game = {
			id: "game:abandoned",
			config: {
				items: {},
			},
		};
		await act(async () => {
			startTransition(() => {
				root.render(
					createElement(
						RegistryContext.Provider,
						{
							value: registry,
						},
						createElement(
							Suspense,
							{
								fallback: null,
							},
							createElement(GameAudio),
							createElement(SuspendOnDemand, {
								suspend: true,
							}),
						),
					),
				);
			});
			await Promise.resolve();
		});

		expect(createGameAudioRuntimeFxMock).toHaveBeenCalledOnce();
		committedListener(jobStartedBatch);
		await vi.waitFor(() => expect(committed.play).toHaveBeenCalledOnce());
		expect(abandoned.play).not.toHaveBeenCalled();
	});

	it("keeps one exact audio under StrictMode and closes it exactly once", async () => {
		const harness = createAudioHarness();
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		const { root } = await renderAudio({
			strict: true,
		});

		expect(createGameAudioRuntimeFxMock).toHaveBeenCalledOnce();
		window.dispatchEvent(new Event("pointerdown"));
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);

		await vi.waitFor(() => {
			expect(harness.unlock).toHaveBeenCalledTimes(2);
			expect(harness.play).toHaveBeenCalledOnce();
		});

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await vi.waitFor(() => expect(harness.close).toHaveBeenCalledOnce());
		expect(createGameAudioRuntimeFxMock).toHaveBeenCalledOnce();
	});

	it("closes the audio exactly once when the owning registry is disposed", async () => {
		let pendingCommands = 0;
		let commandFinalizations = 0;
		const harness = createAudioHarness({
			playFx: () =>
				Effect.sync(() => {
					pendingCommands += 1;
				}).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Effect.sync(() => {
							commandFinalizations += 1;
						}),
					),
				),
		});
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		const { registry, root } = await renderAudio();
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		await vi.waitFor(() => expect(pendingCommands).toBe(1));

		registry.dispose();
		registry.dispose();
		await vi.waitFor(() => {
			expect(commandFinalizations).toBe(1);
			expect(harness.close).toHaveBeenCalledOnce();
		});

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		expect(harness.close).toHaveBeenCalledOnce();
	});

	it("interrupts a pending audio command before closing its audio", async () => {
		let pendingCommands = 0;
		let commandFinalizations = 0;
		const harness = createAudioHarness({
			playFx: () =>
				Effect.sync(() => {
					pendingCommands += 1;
				}).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Effect.sync(() => {
							commandFinalizations += 1;
						}),
					),
				),
		});
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		const { root } = await renderAudio();
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		await vi.waitFor(() => expect(pendingCommands).toBe(1));

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);

		await vi.waitFor(() => {
			expect(commandFinalizations).toBe(1);
			expect(harness.close).toHaveBeenCalledOnce();
		});
	});

	it("interrupts old pending work when the Game is replaced", async () => {
		let pendingCommands = 0;
		let commandFinalizations = 0;
		const first = createAudioHarness({
			playFx: () =>
				Effect.sync(() => {
					pendingCommands += 1;
				}).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Effect.sync(() => {
							commandFinalizations += 1;
						}),
					),
				),
		});
		const second = createAudioHarness();
		const synths = [
			first.audio,
			second.audio,
		];
		let synthIndex = 0;
		createGameAudioRuntimeFxMock.mockImplementation(() =>
			Effect.succeed(synths[synthIndex++] ?? second.audio),
		);
		const { render } = await renderAudio();
		const firstListener = eventState.listener;
		if (firstListener === null) throw new Error("Missing first game audio event listener.");
		firstListener(jobStartedBatch);
		await vi.waitFor(() => expect(pendingCommands).toBe(1));

		eventState.game = {
			id: "game:second",
			config: {
				items: {},
			},
		};
		await act(async () => render());
		await vi.waitFor(() => {
			expect(commandFinalizations).toBe(1);
			expect(first.close).toHaveBeenCalledOnce();
		});

		const secondListener = eventState.listener;
		if (secondListener === null) throw new Error("Missing second game audio event listener.");
		secondListener(jobCompletedBatch);
		await vi.waitFor(() => expect(second.play).toHaveBeenCalledOnce());
		expect(first.play).not.toHaveBeenCalled();
	});

	it("keeps unlock, batch, and disposal failures isolated with the existing diagnostics", async () => {
		const unlockError = new Error("unlock failed");
		const playError = new Error("play failed");
		const closeError = new Error("close failed");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const harness = createAudioHarness({
			unlockFx: Effect.fail(unlockError),
			playFx: () => Effect.die(playError),
			closeFx: Effect.fail(closeError),
		});
		createGameAudioRuntimeFxMock.mockImplementation(() => Effect.succeed(harness.audio));
		const { root } = await renderAudio();

		window.dispatchEvent(new Event("pointerdown"));
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalledWith(
				"Arkini game audio unlock failed; gameplay continues.",
				unlockError,
			);
			expect(consoleError).toHaveBeenCalledWith(
				"Arkini game audio batch failed; gameplay continues.",
				Cause.die(playError),
			);
		});

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await vi.waitFor(() =>
			expect(consoleError).toHaveBeenCalledWith(
				"Arkini game audio disposal failed; gameplay continues.",
				closeError,
			),
		);
	});
});
