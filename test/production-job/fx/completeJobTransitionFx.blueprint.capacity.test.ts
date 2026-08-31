import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { placeDropForTestFx } from "~test/item-placement/support/placeDropForTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint direct output capacity", () => {
	it("reserves a shared target maxCount across concurrent blueprint jobs", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const first = yield* spawnBlueprintFx({
					id: "runtime:first",
					space: 0,
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				const second = yield* spawnBlueprintFx({
					id: "runtime:second",
					space: 0,
					itemId: "blueprint:plain",
					x: 1,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: first.id,
					lineId: "line:blueprint:plain",
				});
				const secondStart = yield* startLineFx({
					ownerItemId: second.id,
					lineId: "line:blueprint:plain",
				}).pipe(Effect.result);
				const placement = yield* placeDropForTestFx({
					originItemId: second.id,
					drop: {
						itemId: "item:target",
						quantity: {
							min: 1,
							max: 1,
						},
						placement: "drop",
						rules: [],
					},
				}).pipe(Effect.result);
				const spawned = yield* spawnItemFx({
					id: "runtime:forbidden-target",
					itemId: "item:target",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				}).pipe(Effect.result);
				return {
					secondStart,
					placement,
					spawned,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Result.isFailure(result.secondStart)).toBe(true);
		if (Result.isFailure(result.secondStart)) {
			expect(result.secondStart.failure).toMatchObject({
				_tag: "OutputCapacityError",
				itemId: "item:target",
				maxCount: 1,
			});
		}
		expect(Result.isFailure(result.placement)).toBe(true);
		if (Result.isFailure(result.placement)) {
			expect(result.placement.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(Result.isFailure(result.spawned)).toBe(true);
		if (Result.isFailure(result.spawned)) {
			expect(result.spawned.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(result.runtime.jobs).toHaveLength(1);
	});

	it("rejects enqueue when the active reservation already fills direct maxCount", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer:limited",
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
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:limited",
				});
				const queued = yield* enqueueLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:limited",
				}).pipe(Effect.result);
				return {
					queued,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.queued).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "OutputCapacityError",
					itemId: "item:queue-product",
				}),
			),
		);
		expect(result.runtime.jobs).toHaveLength(1);
		expect(result.runtime.jobQueue ?? []).toEqual([]);
	});
});
