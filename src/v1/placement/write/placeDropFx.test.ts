import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { placeDropFx } from "./placeDropFx";
import {
	boardLocation,
	inventoryLocation,
	placementTestConfig,
} from "~/v1/placement/fx/test/placementTestConfig";

describe("placeDropFx", () => {
	it("fills board stacks, then nearby board cells, then inventory", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:log",
					itemId: "log",
					location: boardLocation(1),
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "blocker",
					location: boardLocation(3),
					quantity: 1,
				});

				const placement = yield* placeDropFx({
					drop: {
						itemId: "log",
						placement: "drop",
						quantity: 5,
					},
					originItemId: "runtime:origin",
				});
				const runtime = yield* readRuntimeFx();

				return {
					placement,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(result.placement.placement.stack).toEqual([
			{
				item: expect.objectContaining({
					id: "runtime:log",
					quantity: 3,
				}),
				quantity: 1,
			},
		]);
		expect(result.placement.placement.spawn).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					id: "log",
				}),
				location: boardLocation(2),
				quantity: 3,
			}),
			expect.objectContaining({
				item: expect.objectContaining({
					id: "log",
				}),
				location: inventoryLocation(0),
				quantity: 1,
			}),
		]);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "log")
				.map((item) => item.quantity),
		).toEqual([
			3,
			3,
			1,
		]);
	});

	it("places inventory-only drops directly into inventory stacks and cells", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:inventory-item",
					itemId: "inventory-only",
					location: inventoryLocation(1),
					quantity: 1,
				});

				const placement = yield* placeDropFx({
					drop: {
						itemId: "inventory-only",
						placement: "random",
						quantity: 3,
					},
					originItemId: "runtime:origin",
				});
				const runtime = yield* readRuntimeFx();

				return {
					placement,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(result.placement.placement.stack).toEqual([
			{
				item: expect.objectContaining({
					id: "runtime:inventory-item",
					quantity: 2,
				}),
				quantity: 1,
			},
		]);
		expect(result.placement.placement.spawn).toEqual([
			expect.objectContaining({
				location: inventoryLocation(0),
				quantity: 2,
			}),
		]);
		expect(
			result.runtime.items.some(
				(item) => item.item.id === "inventory-only" && item.location.scope === "board",
			),
		).toBe(false);
	});

	it("rejects incomplete placement without committing partial stacks or spawns", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				for (const x of [
					1,
					2,
					3,
				]) {
					yield* spawnItemFx({
						id: `runtime:board:${x}`,
						itemId: "blocker",
						location: boardLocation(x),
						quantity: 1,
					});
				}
				for (const x of [
					0,
					1,
				]) {
					yield* spawnItemFx({
						id: `runtime:inventory:${x}`,
						itemId: "blocker",
						location: inventoryLocation(x),
						quantity: 1,
					});
				}
				const before = yield* readRuntimeFx();
				const placement = yield* Effect.either(
					placeDropFx({
						drop: {
							itemId: "log",
							placement: "drop",
							quantity: 1,
						},
						originItemId: "runtime:origin",
					}),
				);
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					placement,
				};
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.placement)).toBe(true);
		if (Either.isLeft(result.placement)) {
			expect(result.placement.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "log",
				reason: "inventory:full",
				remainingQuantity: 1,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("enforces canonical maxCount before consuming placement capacity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:limited",
					itemId: "limited",
					location: inventoryLocation(0),
					quantity: 2,
				});

				return yield* Effect.either(
					placeDropFx({
						drop: {
							itemId: "limited",
							placement: "drop",
							quantity: 1,
						},
						originItemId: "runtime:origin",
					}),
				);
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "limited",
				reason: "item:max-count",
				remainingQuantity: 1,
			});
		}
	});
});
