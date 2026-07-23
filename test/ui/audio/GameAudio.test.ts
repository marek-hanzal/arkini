// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, StrictMode } from "react";
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

const createSynthHarness = () => {
	const unlock = vi.fn();
	const play = vi.fn();
	const close = vi.fn();
	const synth = {
		unlockFx: Effect.sync(() => unlock()),
		playFx: (cues) => Effect.sync(() => play(cues)),
		closeFx: Effect.sync(() => close()),
	} satisfies createGameAudioSynthFx.Result;

	return {
		close,
		play,
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
			source: "explicit",
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

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	eventState.game = {
		id: "game:first",
	};
	eventState.listener = null;
	document.body.replaceChildren();
});

describe("GameAudio", () => {
	it("unlocks from user input, projects event batches, and closes with the route", async () => {
		const harness = createSynthHarness();
		const createSynthFx = vi.fn<GameAudio.CreateSynthFx>(() => Effect.succeed(harness.synth));
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(GameAudio, {
					createSynthFx,
				}),
			);
		});
		expect(createSynthFx).toHaveBeenCalledOnce();
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

	it("replaces and closes the synth with the route-scoped Game identity", async () => {
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
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(GameAudio, {
					createSynthFx,
				}),
			);
		});
		eventState.game = {
			id: "game:second",
		};
		await act(async () => {
			root.render(
				createElement(GameAudio, {
					createSynthFx,
				}),
			);
		});

		await vi.waitFor(() => expect(first.close).toHaveBeenCalledOnce());
		expect(createSynthFx).toHaveBeenCalledTimes(2);

		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobCompletedBatch);
		await vi.waitFor(() => expect(second.play).toHaveBeenCalledOnce());
		expect(first.play).not.toHaveBeenCalled();
	});

	it("survives StrictMode effect replay without retaining the disposed synth", async () => {
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
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					StrictMode,
					null,
					createElement(GameAudio, {
						createSynthFx,
					}),
				),
			);
		});

		await vi.waitFor(() => expect(first.close).toHaveBeenCalledOnce());
		expect(createSynthFx).toHaveBeenCalledTimes(2);

		window.dispatchEvent(new Event("pointerdown"));
		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing game audio event listener.");
		listener(jobStartedBatch);

		await vi.waitFor(() => {
			expect(second.unlock).toHaveBeenCalledOnce();
			expect(second.play).toHaveBeenCalledOnce();
		});
		expect(first.unlock).not.toHaveBeenCalled();
		expect(first.play).not.toHaveBeenCalled();

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await vi.waitFor(() => expect(second.close).toHaveBeenCalledOnce());
	});
});
