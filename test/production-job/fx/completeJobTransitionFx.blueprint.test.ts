import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint completion placement", () => {
	it("removes the depleted blueprint and places the first output at its freed cell", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:plain",
					x: 1,
					y: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					owner,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		const target = result.runtime.items.find((item) => item.item.id === "item:target");
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.id === result.owner.id)).toBe(false);
		expect(target).toMatchObject({
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 1,
				},
			},
			quantity: 1,
		});
		expect(target?.id).not.toBe(result.owner.id);
	});

	it("places target, by-products, and returned reservations in one completion", () => {
		const runtime = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemId: "item:tool",
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
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.map((item) => item.item.id)).toEqual(
			expect.arrayContaining([
				"item:target-unlimited",
				"item:byproduct",
				"item:tool",
			]),
		);
		expect(
			runtime.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});
});
