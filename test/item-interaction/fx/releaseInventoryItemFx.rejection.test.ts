import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";

import { run, spawnInventoryOpenerFx } from "../support/dropItemFixture";

describe("releaseInventoryItemFx rejection", () => {
	it("rejects a release that could only fall back into passive storage", () => {
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
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
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
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const outcome = yield* Effect.result(
					releaseInventoryItemFx({
						itemId: inventoryItem.id,
						revision: inventoryItem.revision,
						location: inventoryLocation,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					before,
					outcome,
				};
			}),
		);

		expect(Result.isFailure(result.outcome)).toBe(true);
		if (Result.isFailure(result.outcome)) {
			expect(result.outcome.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "board:full",
			});
		}
		expect(result.after).toEqual(result.before);
	});
	it("rejects an Inventory release without its physical opener", () => {
		const inventoryLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const outcome = run(
			Effect.gen(function* () {
				const inventoryItem = yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryLocation,
					quantity: 1,
				});
				return yield* Effect.result(
					releaseInventoryItemFx({
						itemId: inventoryItem.id,
						revision: inventoryItem.revision,
						location: inventoryLocation,
					}),
				);
			}),
		);

		expect(Result.isFailure(outcome)).toBe(true);
		if (Result.isFailure(outcome)) {
			expect(outcome.failure).toMatchObject({
				_tag: "InventoryOpenerUnavailableError",
				itemId: "runtime:inventory-water",
			});
		}
	});
});
