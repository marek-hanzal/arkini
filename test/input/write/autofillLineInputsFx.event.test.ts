import { Effect, Fiber, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";

describe("autofillLineInputsFx events", () => {
	it("publishes visible source transfers in committed autofill order", async () => {
		const transition = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* spawnItemFx({
						id: ownerItemId,
						itemId: "workshop",
						location: workshopLocation,
						quantity: 1,
					});
					yield* spawnItemFx({
						id: "runtime:far",
						itemId: "water",
						location: sourceLocation(3),
						quantity: 1,
					});
					yield* spawnItemFx({
						id: "runtime:near",
						itemId: "water",
						location: sourceLocation(1),
						quantity: 1,
					});
					yield* spawnItemFx({
						id: "runtime:inventory",
						itemId: "water",
						location: {
							scope: "inventory",
							position: { x: 0, y: 0 },
						},
						quantity: 2,
					});

					const transitions = yield* CommittedTransitionsFx;
					const subscription = yield* transitions.subscribe;
					const nextFiber = yield* subscription.changes.pipe(Stream.runHead, Effect.fork);
					yield* autofillLineInputsFx({ ownerItemId, lineId });
					return Option.getOrThrow(yield* Fiber.join(nextFiber));
				}),
			).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(transition.events).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
				sourceItemId: "runtime:near",
				canonicalItemId: "water",
				previousSourceLocation: sourceLocation(1),
				previousQuantity: 1,
				storedQuantity: 1,
				resultingQuantity: 0,
				ownerItemId,
				lineId,
				inputIndex: 0,
			},
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
				sourceItemId: "runtime:far",
				canonicalItemId: "water",
				previousSourceLocation: sourceLocation(3),
				previousQuantity: 1,
				storedQuantity: 1,
				resultingQuantity: 0,
				ownerItemId,
				lineId,
				inputIndex: 0,
			},
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
				sourceItemId: "runtime:inventory",
				canonicalItemId: "water",
				previousSourceLocation: {
					scope: "inventory",
					position: { x: 0, y: 0 },
				},
				previousQuantity: 2,
				storedQuantity: 1,
				resultingQuantity: 1,
				ownerItemId,
				lineId,
				inputIndex: 0,
			},
		]);
	});
});
