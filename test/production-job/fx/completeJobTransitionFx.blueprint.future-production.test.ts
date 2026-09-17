import { Effect, Result } from "effect";
import { expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { runBlueprint } from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";
import { spawnItemFx } from "~test/support/spawnItemFx";

it("produces an intermediate at its future output limit but rejects that output when requested", () => {
	const result = runBlueprint(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "runtime:target",
				itemId: "item:target",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
				quantity: 1,
			});
			const owner = yield* spawnItemFx({
				id: "runtime:blueprint-source",
				itemId: "producer:blueprint-source",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
			});
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineId: "line:producer:blueprint-source",
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 300,
			});
			const produced = yield* readRuntimeFx();
			const blueprint = produced.items.find((item) => item.item.id === "blueprint:plain");
			if (blueprint === undefined) throw new Error("Expected completed blueprint output.");
			const activation = yield* enqueueLineFx({
				ownerItemId: blueprint.id,
				lineId: "line:blueprint:plain",
			}).pipe(Effect.result);
			return {
				produced,
				activation,
				after: yield* readRuntimeFx(),
			};
		}),
	);

	expect(result.produced.jobs).toHaveLength(0);
	expect(result.produced.jobQueue).toHaveLength(0);
	expect(result.activation).toEqual(
		Result.fail(
			expect.objectContaining({
				_tag: "OutputCapacityError",
				itemId: "item:target",
				liveQuantity: 1,
				reservedQuantity: 1,
				maxCount: 1,
			}),
		),
	);
	expect(result.after).toBe(result.produced);
});
