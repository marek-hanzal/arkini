import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint completion rollback", () => {
	it("rolls back the target when a by-product cannot be placed", () => {
		const runtime = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemUid: "blueprint:outcome",
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
						itemUid: "item:blocker",
						location: {
							scope: "board",
							space: 0,
							position,
						},
					});
				}
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:outcome",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.uid === "blueprint:outcome")).toBe(true);
		expect(runtime.items.some((item) => item.item.uid === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.uid === "item:byproduct")).toBe(false);
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
					itemUid: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemUid: "item:tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
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
						itemUid: "item:blocker",
						location: {
							scope: "board",
							space: 0,
							position,
						},
					});
				}
				yield* bufferInputMaterialForTestFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
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

		expect(runtime.items.some((item) => item.item.uid === "blueprint:reserve")).toBe(true);
		expect(runtime.items.some((item) => item.item.uid === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.uid === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
		expect(runtime.items.some((item) => item.location.scope === "reserved")).toBe(true);
	});
});
