import { Deferred, Effect, Fiber, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

describe("autofillLineInputsFx transition", () => {
	it("commits one delivery admission without lying about input storage", async () => {
		const transitions = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* spawnItemFx({
						id: "runtime:workshop",
						itemId: "workshop",
						location: workshopLocation,
						quantity: 1,
					});
					yield* spawnItemFx({
						id: "runtime:water",
						itemId: "water",
						location: sourceLocation(1),
						quantity: 7,
					});
					const transitions = yield* CommittedTransitionsFx;
					const replaySeen = yield* Deferred.make<void>();
					const nextFiber = yield* transitions.changes.pipe(
						Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
						Stream.drop(1),
						Stream.take(1),
						Stream.runCollect,
						Effect.forkChild,
					);
					yield* Deferred.await(replaySeen);
					yield* autofillLineInputsFx({
						ownerItemId: "runtime:workshop",
						lineId: "line:workshop:build",
					});
					return Array.from(yield* Fiber.join(nextFiber));
				}),
			).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(transitions).toHaveLength(1);
		expect(transitions[0]?.events).toEqual([]);
		expect(
			transitions[0]?.runtime.items.find(({ id }) => id === "runtime:water"),
		).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
			quantity: 7,
		});
		expect(
			transitions[0]?.runtime.items.filter(({ location }) => location.scope === "input"),
		).toHaveLength(0);
	});
});
