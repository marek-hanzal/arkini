import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { releaseInventoryItemFx } from "~/item-interaction/write/releaseInventoryItemFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";

import { run, sourceLocation, spawnInventoryOpenerFx } from "./dropItemFx.test/fixture";

describe("dropItemFx / inventory release placement", () => {
	it("releases the whole Inventory stack through board-first placement", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = run(
			Effect.gen(function* () {
				const inventoryOpener = yield* spawnInventoryOpenerFx();
				yield* spawnItemFx({
					id: "runtime:board-water",
					itemId: "water",
					location: sourceLocation,
					quantity: 8,
				});
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 4,
				});
				const outcome = yield* releaseInventoryItemFx({
					itemId: inventoryItem.id,
					revision: inventoryItem.revision,
					location: inventoryLocation,
				});
				return {
					inventoryOpenerId: inventoryOpener.id,
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome.events.map((event) => event.type)).toEqual([
			"item:stacked",
			"item:spawned",
		]);
		expect(
			result.outcome.events.every(
				(event) =>
					!("originItemId" in event) || event.originItemId === result.inventoryOpenerId,
			),
		).toBe(true);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "water")
				.map((item) => ({
					location: item.location,
					quantity: item.quantity,
				})),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					location: sourceLocation,
					quantity: 10,
				}),
				expect.objectContaining({
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 2,
				}),
			]),
		);
		expect(result.runtime.items.some((item) => item.id === "runtime:inventory-water")).toBe(
			false,
		);
	});
	it("releases into compatible Board stack capacity when every cell is occupied", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = run(
			Effect.gen(function* () {
				yield* spawnInventoryOpenerFx();
				yield* spawnItemFx({
					id: "runtime:board-water",
					itemId: "water",
					location: sourceLocation,
					quantity: 8,
				});
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						if (x === sourceLocation.position.x && y === sourceLocation.position.y) {
							continue;
						}
						yield* spawnItemFx({
							id: `runtime:blocker:${blockerIndex}`,
							itemId: "stone",
							location: {
								scope: "board",
								space: 0,
								position: {
									x,
									y,
								},
							},
							quantity: 1,
						});
						blockerIndex += 1;
					}
				}
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 2,
				});
				const outcome = yield* releaseInventoryItemFx({
					itemId: inventoryItem.id,
					revision: inventoryItem.revision,
					location: inventoryLocation,
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome.events.map((event) => event.type)).toEqual([
			"item:stacked",
		]);
		expect(
			result.runtime.items.find((item) => item.id === "runtime:board-water")?.quantity,
		).toBe(10);
		expect(result.runtime.items.some((item) => item.id === "runtime:inventory-water")).toBe(
			false,
		);
		expect(result.runtime.items.filter((item) => item.location.scope === "board")).toHaveLength(
			6,
		);
	});
});
