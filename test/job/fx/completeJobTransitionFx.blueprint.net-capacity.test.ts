import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { readPlannedLineNetMaximumOutputQuantitiesFx } from "~/engine/job/fx/read/readPlannedLineNetMaximumOutputQuantitiesFx";
import { readReservedJobOutputQuantitiesFx } from "~/engine/job/fx/read/readReservedJobOutputQuantitiesFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { blueprintConfig } from "~test/job/fx/completeJobTransitionFx.blueprint.test/config";
import { startLineFx } from "~test/job/support/startLineTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint net output capacity", () => {
	it("does not let a consuming candidate cancel another active job reservation", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:shared-source",
					itemId: "producer:shared-source",
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
				const consumer = yield* spawnItemFx({
					id: "runtime:shared-consumer",
					itemId: "producer:shared-consumer",
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
				const shared = yield* spawnItemFx({
					id: "runtime:shared",
					itemId: "item:shared",
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
				yield* storeInputMaterialFx({
					ownerItemId: consumer.id,
					lineId: "line:producer:shared-consumer",
					inputIndex: 0,
					sourceItemId: shared.id,
					sourceItemRevision: shared.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: source.id,
					lineId: "line:producer:shared-source",
				});
				const runtime = yield* readRuntimeFx();
				const resolution = yield* resolveLineStartFx({
					ownerItemId: consumer.id,
					lineId: "line:producer:shared-consumer",
					runtime,
				});
				if (resolution.run.plan === undefined) {
					throw new Error("Expected exact consuming plan.");
				}
				const consumerDefinition = blueprintConfig.items["producer:shared-consumer"];
				if (consumerDefinition?.type !== "producer") {
					throw new Error("Missing shared consumer producer.");
				}
				const line = consumerDefinition.lines[0];
				return {
					candidate: yield* readPlannedLineNetMaximumOutputQuantitiesFx({
						line,
						plan: resolution.run.plan,
						runtime,
					}),
					reserved: yield* readReservedJobOutputQuantitiesFx({
						runtime,
					}),
				};
			}),
		);

		expect([
			...result.candidate,
		]).toEqual([]);
		expect(result.reserved.get("item:shared")?.quantity).toBe(1);
	});

	it("projects a direct cap above missing inputs and keeps read and command net semantics aligned", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:reserve",
					space: 0,
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				yield* spawnItemFx({
					id: "runtime:byproduct",
					itemId: "item:byproduct",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 2,
				});
				return yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: yield* readRuntimeFx(),
				});
			}),
		);

		expect(result).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:byproduct",
						},
					},
					actions: {},
				},
			],
		});
	});
});
