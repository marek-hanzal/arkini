import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { setItemQuantityFx } from "~/engine/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { placeDropForTestFx } from "~test/placement/support/placeDropForTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/job/fx/completeJobTransitionFx.blueprint.test/fixture";

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
				_tag: "JobOutputMaxCountError",
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

	it("prevents direct quantity mutation from consuming output capacity promised to a job", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const byproduct = yield* spawnItemFx({
					id: "runtime:byproduct",
					itemId: "item:byproduct",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:output",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:output",
				});
				const updated = yield* setItemQuantityFx({
					itemId: byproduct.id,
					quantity: 2,
					revision: byproduct.revision,
				}).pipe(Effect.result);
				return {
					updated,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Result.isFailure(result.updated)).toBe(true);
		if (Result.isFailure(result.updated)) {
			expect(result.updated.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(result.runtime.items.find((item) => item.id === "runtime:byproduct")?.quantity).toBe(
			1,
		);
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
					_tag: "JobOutputMaxCountError",
					itemId: "item:queue-product",
				}),
			),
		);
		expect(result.runtime.jobs).toHaveLength(1);
		expect(result.runtime.jobQueue ?? []).toEqual([]);
	});
});
