import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";

import { emitCompletedEventFx } from "./createGameSession.test/fixture";

describe("createGameSessionFx / transition replay", () => {
	it("exposes its authoritative committed transition source as truly read-only", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});

		try {
			expect(Atom.isWritable(session.committedTransitionAtom)).toBe(false);
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("replays one exact current committed transition and then every later commit in order", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		type ObservedTransition = {
			readonly sequence: number;
			readonly previousItems: number | null;
			readonly currentItems: number;
			readonly eventJobIds: ReadonlyArray<string>;
		};
		const transitions: ObservedTransition[] = [];
		let publishReplay: ((transitions: ReadonlyArray<ObservedTransition>) => void) | undefined;
		const replayDelivered = new Promise<ReadonlyArray<ObservedTransition>>((resolve) => {
			publishReplay = resolve;
		});
		let publishAll: ((transitions: ReadonlyArray<ObservedTransition>) => void) | undefined;
		const allDelivered = new Promise<ReadonlyArray<ObservedTransition>>((resolve) => {
			publishAll = resolve;
		});
		const unsubscribe = session.subscribeTransitions((transition) => {
			transitions.push({
				sequence: transition.sequence,
				previousItems: transition.previousRuntime?.items.length ?? null,
				currentItems: transition.runtime.items.length,
				eventJobIds: transition.events.flatMap((event) =>
					"jobId" in event
						? [
								event.jobId,
							]
						: [],
				),
			});
			if (transitions.length === 1)
				publishReplay?.([
					...transitions,
				]);
			if (transitions.length === 3)
				publishAll?.([
					...transitions,
				]);
		});

		try {
			expect(await replayDelivered).toEqual([
				{
					sequence: 0,
					previousItems: null,
					currentItems: 0,
					eventJobIds: [],
				},
			]);

			await session.run(
				spawnItemFx({
					id: "runtime:transition:ordered",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			await session.run(emitCompletedEventFx("job:transition:ordered"));

			expect(await allDelivered).toEqual([
				{
					sequence: 0,
					previousItems: null,
					currentItems: 0,
					eventJobIds: [],
				},
				{
					sequence: 1,
					previousItems: 0,
					currentItems: 1,
					eventJobIds: [],
				},
				{
					sequence: 2,
					previousItems: 1,
					currentItems: 1,
					eventJobIds: [
						"job:transition:ordered",
					],
				},
			]);
			expect(session.getTransitionSnapshot().sequence).toBe(2);
			expect(session.getTransitionSnapshot().runtime).toBe(session.getSnapshot());
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("does not replay the initial committed transition to React subscribers", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const initial = session.getSnapshot();
		let notifications = 0;
		let markRuntimeDelivered: (() => void) | undefined;
		const runtimeDelivered = new Promise<void>((resolve) => {
			markRuntimeDelivered = resolve;
		});
		const unsubscribe = session.subscribe(() => {
			notifications += 1;
			markRuntimeDelivered?.();
		});

		try {
			expect(session.getSnapshot()).toBe(initial);
			expect(notifications).toBe(0);
			await session.run(
				spawnItemFx({
					id: "runtime:react-subscriber:marker",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			await runtimeDelivered;
			expect(notifications).toBe(1);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
