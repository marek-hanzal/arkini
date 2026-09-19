import { Deferred, Effect, Fiber, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { useGameFx } from "~test/support/useGameFx";
import { autofillLineInputFx } from "~/production-input/fx/autofillLineInputFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { readGameAudioCuesFn } from "~/game-audio/fn/readGameAudioCuesFn";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

describe("autofillLineInputsFx transition", () => {
	for (const mode of [
		"targeted",
		"queue",
	] as const) {
		it.effect(`publishes one audible ${mode} Autofill admission without claiming storage`, () =>
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
				if (mode === "queue")
					yield* enqueueLineFx({
						ownerItemId: "runtime:workshop",
						lineId: "line:workshop:build",
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
				if (mode === "targeted")
					yield* autofillLineInputFx({
						inputIndex: 0,
						ownerItemId: "runtime:workshop",
						lineId: "line:workshop:build",
					});
				else
					yield* runTickRuntimeByFx({
						elapsedMs: 100,
					});
				const committed = Array.from(yield* Fiber.join(nextFiber));

				expect(committed).toHaveLength(1);
				expect(committed[0]?.events).toEqual([
					{
						type: "line-input:autofill-started",
						canonicalItemId: "workshop",
						ownerItemId: "runtime:workshop",
						lineId: "line:workshop:build",
						scheduledQuantity: 3,
					},
				]);
				expect(readGameAudioCuesFn(committed[0]!, {})).toEqual([
					{
						event: "line-input:autofill-started",
						strength: 1 + Math.log2(3),
					},
				]);
				const beforeRetry = yield* transitions.read;
				if (mode === "targeted") {
					expect(
						yield* autofillLineInputFx({
							ownerItemId: "runtime:workshop",
							lineId: "line:workshop:build",
							inputIndex: 0,
						}),
					).toBe(0);
					expect((yield* transitions.read).sequence).toBe(beforeRetry.sequence);
				} else {
					yield* runTickRuntimeByFx({
						elapsedMs: 100,
					});
					expect((yield* transitions.read).events).not.toContainEqual(
						expect.objectContaining({
							type: "line-input:autofill-started",
						}),
					);
				}
				expect(
					committed[0]?.runtime.items.find(({ id }) => id === "runtime:water"),
				).toMatchObject({
					location: {
						phase: "outbound",
						scope: "delivery",
					},
					quantity: 7,
				});
				expect(
					committed[0]?.runtime.items.filter(
						({ location }) => location.scope === "input",
					),
				).toHaveLength(0);
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);
	}
});
