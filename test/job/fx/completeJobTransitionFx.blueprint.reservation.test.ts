import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { resolveOneHopOutputCapacityFx } from "~/engine/job/fx/read/resolveOneHopOutputCapacityFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import {
	runBlueprint,
	sourceLine,
	spawnBlueprintFx,
} from "~test/job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint one-hop reservations", () => {
	it("treats an existing blueprint as committed capacity for its capped target", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const blueprint = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:capped",
					space: 0,
					x: 1,
					y: 0,
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
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const sourceStarted = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:capped-blueprint",
				}).pipe(Effect.result);
				const blueprintStarted = yield* startLineFx({
					ownerItemId: blueprint.id,
					lineId: "line:blueprint:capped",
				}).pipe(Effect.result);
				return {
					blueprintStarted,
					lines,
					sourceStarted,
				};
			}),
		);

		expect(result.lines).toMatchObject({
			kind: "available",
			line: expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:producer:capped-blueprint",
					availability: {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-max-count",
							intermediateItemId: "blueprint:capped",
							itemId: "item:target",
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
						},
					},
				}),
			]),
		});
		expect(result.sourceStarted).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:target",
					reservedQuantity: 2,
				}),
			),
		);
		expect(Result.isSuccess(result.blueprintStarted)).toBe(true);
	});

	it("reserves a blueprint's capped target while the blueprint-producing job is pending", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
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
				const firstStarted = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:blueprint-source",
				}).pipe(Effect.result);
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const secondStarted = yield* enqueueLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:blueprint-source",
				}).pipe(Effect.result);
				return {
					firstStarted,
					lines,
					secondStarted,
				};
			}),
		);

		expect(Result.isSuccess(result.firstStarted)).toBe(true);
		expect(result.lines).toMatchObject({
			kind: "available",
			line: expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:producer:blueprint-source",
					availability: {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-max-count",
							intermediateItemId: "blueprint:plain",
							itemId: "item:target",
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
						},
					},
				}),
			]),
		});
		expect(result.secondStarted).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:target",
					reservedQuantity: 2,
				}),
			),
		);
	});

	it("preserves weighted branch correlation across the one-hop reservation", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
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
				const runtime = yield* readRuntimeFx();
				const resolved = yield* resolveOneHopOutputCapacityFx({
					line: sourceLine("line:producer:correlated-blueprint"),
					runtime,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:correlated-blueprint",
				}).pipe(Effect.result);
				return {
					resolved,
					started,
				};
			}),
		);

		expect(result.resolved).toBeUndefined();
		expect(Result.isSuccess(result.started)).toBe(true);
	});
});
