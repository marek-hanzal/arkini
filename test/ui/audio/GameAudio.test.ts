// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Cause, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { StrictMode, Suspense, act, createElement, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { useGameEvents } from "~/bridge/event/useGameEvents";
import { GameEventEnumSchema } from "~/bridge/event/useGameEvents";
import type { createGameAudioSynthFx } from "~/ui/audio/createGameAudioSynthFx";

const eventState = vi.hoisted(() => ({
	game: {
		id: "game:first",
	},
	listener: null as ((batch: useGameEvents.Batch) => void | PromiseLike<void>) | null,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => eventState.game,
}));

vi.mock("~/bridge/event/useGameEvents", async (importOriginal) => ({
	...(await importOriginal()),
	useGameEvents: (listener: (batch: useGameEvents.Batch) => void | PromiseLike<void>) => {
		eventState.listener = listener;
	},
}));

import { GameAudio } from "~/ui/audio/GameAudio";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

const createSynthHarness = ({
	closeFx,
	playFx,
	prepareFx,
	unlockFx,
}: {
	readonly closeFx?: Effect.Effect<void, unknown>;
	readonly playFx?: createGameAudioSynthFx.Result["playFx"];
	readonly prepareFx?: Effect.Effect<void, unknown>;
	readonly unlockFx?: Effect.Effect<void, unknown>;
} = {}) => {
	const prepare = vi.fn();
	const unlock = vi.fn();
	const play = vi.fn();
	const close = vi.fn();
	const synth = {
		prepareFx: prepareFx ?? Effect.sync(() => prepare()),
		unlockFx: unlockFx ?? Effect.sync(() => unlock()),
		playFx: playFx ?? ((cues) => Effect.sync(() => play(cues))),
		closeFx: closeFx ?? Effect.sync(() => close()),
	} satisfies createGameAudioSynthFx.Result;

	return {
		close,
		play,
		prepare,
		synth,
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
} satisfies useGameEvents.Batch;

const jobCompletedBatch = {
	events: [
		{
			type: GameEventEnumSchema.enum.JobCompleted,
			jobId: "job:2",
			ownerItemId: "runtime:producer",
			lineId: "line:1",
		},
	],
} satisfies useGameEvents.Batch;

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

const renderAudio = async ({
	createSynthFx,
	registry = makeRegistry(),
	strict = false,
}: {
	readonly createSynthFx: GameAudio.CreateSynthFx;
	readonly registry?: AtomRegistry.AtomRegistry;
	readonly strict?: boolean;
}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = (nextCreateSynthFx: GameAudio.CreateSynthFx = createSynthFx) =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				strict
					? createElement(
							StrictMode,
							null,
							createElement(GameAudio, {
								createSynthFx: nextCreateSynthFx,
							}),
						)
					: createElement(GameAudio, {
							createSynthFx: nextCreateSynthFx,
						}),
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
	};
	eventState.listener = null;
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("GameAudio", () => {
	it("unlocks from React-local input listeners and plays transient event batches", async () => {
		const harness = createSynthHarness();
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		const { root } = await renderAudio({
			createSynthFx,
		});
		expect(createSynthFx).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(harness.prepare).toHaveBeenCalledOnce());
		expect(harness.unlock).not.toHaveBeenCalled();

		window.dispatchEvent(new Event("pointerdown"));
		await vi.waitFor(() => expect(harness.unlock).toHaveBeenCalledOnce());

		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		await vi.waitFor(() =>
			expect(harness.play).toHaveBeenCalledWith([
				{
					kind: "job-start",
					strength: 1,
				},
			]),
		);

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await vi.waitFor(() => expect(harness.close).toHaveBeenCalledOnce());
	});

	it("does not lose synchronously settling unlocks or ordered event batches", async () => {
		const harness = createSynthHarness();
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		await renderAudio({
			createSynthFx,
		});

		window.dispatchEvent(new Event("pointerdown"));
		window.dispatchEvent(new Event("keydown"));
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		listener(jobCompletedBatch);

		await vi.waitFor(() => {
			expect(harness.unlock).toHaveBeenCalledTimes(2);
			expect(harness.play).toHaveBeenCalledTimes(2);
		});
		expect(harness.play.mock.calls.map(([cues]) => cues[0]?.kind)).toEqual([
			"job-start",
			"job-complete",
		]);
	});

	it("replaces the exact Game resource, closes the old synth, and routes later batches only to the new synth", async () => {
		const first = createSynthHarness();
		const second = createSynthHarness();
		const synths = [
			first.synth,
			second.synth,
		];
		let synthIndex = 0;
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(synths[synthIndex++] ?? second.synth),
		);
		const { render } = await renderAudio({
			createSynthFx,
		});

		eventState.game = {
			id: "game:second",
		};
		await act(async () => render());

		await vi.waitFor(() => expect(first.close).toHaveBeenCalledOnce());
		expect(createSynthFx).toHaveBeenCalledTimes(2);

		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobCompletedBatch);
		await vi.waitFor(() => expect(second.play).toHaveBeenCalledOnce());
		expect(first.play).not.toHaveBeenCalled();
	});

	it("replaces the synth when its factory identity changes for the same Game", async () => {
		const first = createSynthHarness();
		const second = createSynthHarness();
		const createFirstSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(first.synth),
		);
		const createSecondSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(second.synth),
		);
		const { render } = await renderAudio({
			createSynthFx: createFirstSynthFx,
		});

		await act(async () => render(createSecondSynthFx));

		await vi.waitFor(() => {
			expect(first.close).toHaveBeenCalledOnce();
			expect(createSecondSynthFx).toHaveBeenCalledOnce();
		});
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);
		await vi.waitFor(() => expect(second.play).toHaveBeenCalledOnce());
		expect(first.play).not.toHaveBeenCalled();
	});

	it("ignores a stale event callback after replacing the Game identity", async () => {
		const first = createSynthHarness();
		const second = createSynthHarness();
		const synths = [
			first.synth,
			second.synth,
		];
		let synthIndex = 0;
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(synths[synthIndex++] ?? second.synth),
		);
		const { render } = await renderAudio({
			createSynthFx,
		});
		const staleListener = eventState.listener;
		if (staleListener === null) throw new Error("Missing first game audio event listener.");

		eventState.game = {
			id: "game:second",
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
		const committed = createSynthHarness();
		const abandoned = createSynthHarness();
		const createCommittedSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(committed.synth),
		);
		const createAbandonedSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(abandoned.synth),
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
						createElement(GameAudio, {
							createSynthFx: createCommittedSynthFx,
						}),
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
							createElement(GameAudio, {
								createSynthFx: createAbandonedSynthFx,
							}),
							createElement(SuspendOnDemand, {
								suspend: true,
							}),
						),
					),
				);
			});
			await Promise.resolve();
		});

		expect(createAbandonedSynthFx).not.toHaveBeenCalled();
		committedListener(jobStartedBatch);
		await vi.waitFor(() => expect(committed.play).toHaveBeenCalledOnce());
		expect(abandoned.play).not.toHaveBeenCalled();
	});

	it("keeps one exact synth under StrictMode and closes it exactly once", async () => {
		const harness = createSynthHarness();
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		const { root } = await renderAudio({
			createSynthFx,
			strict: true,
		});

		expect(createSynthFx).toHaveBeenCalledOnce();
		window.dispatchEvent(new Event("pointerdown"));
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);

		await vi.waitFor(() => {
			expect(harness.unlock).toHaveBeenCalledOnce();
			expect(harness.play).toHaveBeenCalledOnce();
		});

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await vi.waitFor(() => expect(harness.close).toHaveBeenCalledOnce());
		expect(createSynthFx).toHaveBeenCalledOnce();
	});

	it("closes the synth exactly once when the owning registry is disposed", async () => {
		let pendingCommands = 0;
		let commandFinalizations = 0;
		const harness = createSynthHarness({
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
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		const { registry, root } = await renderAudio({
			createSynthFx,
		});
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

	it("interrupts a pending audio command before closing its synth", async () => {
		let pendingCommands = 0;
		let commandFinalizations = 0;
		const harness = createSynthHarness({
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
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		const { root } = await renderAudio({
			createSynthFx,
		});
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
		const first = createSynthHarness({
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
		const second = createSynthHarness();
		const synths = [
			first.synth,
			second.synth,
		];
		let synthIndex = 0;
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() =>
			Effect.succeed(synths[synthIndex++] ?? second.synth),
		);
		const { render } = await renderAudio({
			createSynthFx,
		});
		const firstListener = eventState.listener;
		if (firstListener === null) throw new Error("Missing first game audio event listener.");
		firstListener(jobStartedBatch);
		await vi.waitFor(() => expect(pendingCommands).toBe(1));

		eventState.game = {
			id: "game:second",
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
		const harness = createSynthHarness({
			unlockFx: Effect.fail(unlockError),
			playFx: () => Effect.die(playError),
			closeFx: Effect.fail(closeError),
		});
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		const { root } = await renderAudio({
			createSynthFx,
		});

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
