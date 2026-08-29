import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { runTickRuntimeByFx } from "~test/support/tick/runTickRuntimeByFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint completion rollback", () => {
	it("rolls back the target when a by-product cannot be placed", () => {
		const runtime = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:output",
					x: 0,
					y: 0,
				});
				for (const [index, position] of [
					{
						x: 1,
						y: 0,
					},
					{
						x: 2,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:byproduct-blocker:${index}`,
						itemId: "item:blocker",
						location: {
							scope: "board",
							space: 0,
							position,
						},
						quantity: 1,
					});
				}
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:output",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "blueprint:output")).toBe(true);
		expect(runtime.items.some((item) => item.item.id === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.id === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
	});

	it("rolls back target and by-products when the final reservation cannot return", () => {
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
				for (const [index, position] of [
					{
						x: 2,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:blocker:${index}`,
						itemId: "item:blocker",
						location: {
							scope: "board",
							space: 0,
							position,
						},
						quantity: 1,
					});
				}
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

		expect(runtime.items.some((item) => item.item.id === "blueprint:reserve")).toBe(true);
		expect(runtime.items.some((item) => item.item.id === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.id === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
		expect(runtime.items.some((item) => item.location.scope === "reserved")).toBe(true);
	});
});
