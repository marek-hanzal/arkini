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
} from "~test/job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint one-hop capacity", () => {
	it("blocks exactly one blueprint hop in both projection and command admission", () => {
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
				const before = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: before,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:blueprint-source",
				}).pipe(Effect.result);
				return {
					after: yield* readRuntimeFx(),
					before,
					lines,
					started,
				};
			}),
		);

		expect(result.lines.kind).toBe("available");
		if (result.lines.kind !== "available") throw new Error("Expected available line list.");
		expect(
			result.lines.line.find((line) => line.lineId === "line:producer:blueprint-source"),
		).toMatchObject({
			availability: {
				kind: "unavailable",
				reason: {
					kind: "downstream-output-max-count",
					intermediateItemId: "blueprint:plain",
					itemId: "item:target",
				},
			},
		});
		expect(result.started).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:target",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});

	it("limits one-hop traversal to Blueprint children and exactly one edge", () => {
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
				yield* spawnItemFx({
					id: "runtime:depletion-product",
					itemId: "item:depletion-product",
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
				const ordinary = yield* resolveOneHopOutputCapacityFx({
					line: sourceLine("line:producer:ordinary-material"),
					runtime,
				});
				const safe = yield* resolveOneHopOutputCapacityFx({
					line: sourceLine("line:producer:safe-blueprint"),
					runtime,
				});
				const random = yield* resolveOneHopOutputCapacityFx({
					line: sourceLine("line:producer:random-blueprint"),
					runtime,
				});
				const cycle = yield* resolveOneHopOutputCapacityFx({
					line: sourceLine("line:producer:two-hop-cycle"),
					runtime,
				});
				const lifecycle = yield* resolveOneHopOutputCapacityFx({
					line: sourceLine("line:producer:lifecycle-blueprint"),
					runtime,
				});
				const starts = {
					ordinary: yield* startLineFx({
						ownerItemId: owner.id,
						lineId: "line:producer:ordinary-material",
					}).pipe(Effect.result),
					cycle: yield* enqueueLineFx({
						ownerItemId: owner.id,
						lineId: "line:producer:two-hop-cycle",
					}).pipe(Effect.result),
				};
				return {
					cycle,
					lifecycle,
					ordinary,
					random,
					safe,
					starts,
				};
			}),
		);

		expect(result.ordinary).toBeUndefined();
		expect(result.safe).toBeUndefined();
		expect(result.random).toMatchObject({
			intermediateItemId: "blueprint:plain",
			itemId: "item:target",
		});
		expect(result.cycle).toBeUndefined();
		expect(result.lifecycle).toMatchObject({
			intermediateItemId: "blueprint:depletion-random",
			itemId: "item:depletion-product",
		});
		expect(Result.isSuccess(result.starts.ordinary)).toBe(true);
		expect(Result.isSuccess(result.starts.cycle)).toBe(true);
	});
});
