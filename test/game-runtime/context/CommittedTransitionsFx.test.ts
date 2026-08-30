import { Deferred, Effect, Fiber, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { GameLayerFx } from "~test/support/game/GameLayerFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";

describe("CommittedTransitionsFx", () => {
	it.effect("replays the current transition and then every later commit", () =>
		Effect.gen(function* () {
			const transitions = yield* CommittedTransitionsFx;
			const replaySeen = yield* Deferred.make<void>();
			const transitionsFiber = yield* transitions.changes.pipe(
				Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
				Stream.take(2),
				Stream.runCollect,
				Effect.forkChild,
			);
			yield* Deferred.await(replaySeen);
			const item = yield* spawnItemFx({
				id: "runtime:subscription:first-tail",
				itemId: "water",
				location: {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
			});
			const [current, next] = Array.from(yield* Fiber.join(transitionsFiber));
			if (current === undefined || next === undefined) {
				return yield* Effect.die("Expected current replay and one committed transition.");
			}

			expect(current.sequence).toBe(0);
			expect(current.previousRuntime).toBeNull();
			expect(current.runtime.items).toEqual([]);
			expect(next.sequence).toBe(1);
			expect(next.previousRuntime).toBe(current.runtime);
			expect(next.runtime.items.some(({ id }) => id === item.id)).toBe(true);
		}).pipe(
			Effect.provide(
				GameLayerFx({
					config: createJobTestConfig(),
				}),
			),
		),
	);
});
