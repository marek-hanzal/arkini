import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { getItemAtFx } from "~/v1/runtime/read/getItemAtFx";
import { getItemFx } from "~/v1/runtime/read/getItemFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { moveItemFx } from "./moveItemFx";
import { removeItemFx } from "./removeItemFx";
import { setItemQuantityFx } from "./setItemQuantityFx";
import { spawnItemFx } from "./spawnItemFx";
import { swapItemsFx } from "./swapItemsFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:runtime-commands",
		title: "Runtime commands",
		board: {
			width: 4,
			height: 4,
		},
		inventory: {
			width: 3,
			height: 2,
		},
	},
	start: {},
	categories: {},
	items: {
		log: {
			id: "log",
			title: "Log",
			description: "A log.",
			asset: {
				source: [
					"asset:log",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
		stone: {
			id: "stone",
			title: "Stone",
			description: "A stone.",
			asset: {
				source: [
					"asset:stone",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

const boardA = {
	scope: "board" as const,
	position: {
		x: 0,
		y: 0,
	},
};
const boardB = {
	scope: "board" as const,
	position: {
		x: 1,
		y: 0,
	},
};
const inventoryA = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};

describe("runtime commands", () => {
	it("owns every spatial and item-state mutation through dedicated atomic commands", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const log = yield* spawnItemFx({
					id: "runtime:log",
					itemId: "log",
					location: boardA,
					quantity: 1,
				});
				const stone = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: inventoryA,
					quantity: 2,
				});
				const moved = yield* moveItemFx({
					itemId: log.id,
					location: boardB,
				});
				const quantity = yield* setItemQuantityFx({
					itemId: log.id,
					quantity: 4,
				});
				const swapped = yield* swapItemsFx({
					firstItemId: log.id,
					secondItemId: stone.id,
				});
				const removed = yield* removeItemFx({
					itemId: stone.id,
				});
				const runtime = yield* readRuntimeFx();

				return {
					moved,
					quantity,
					removed,
					runtime,
					swapped,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.moved.previousLocation).toEqual(boardA);
		expect(result.moved.item.location).toEqual(boardB);
		expect(result.quantity.quantity).toBe(4);
		expect(result.swapped.first.location).toEqual(inventoryA);
		expect(result.swapped.second.location).toEqual(boardB);
		expect(result.removed.id).toBe("runtime:stone");
		expect(result.runtime.items).toEqual([
			result.swapped.first,
		]);
	});

	it("rejects duplicate identities and occupied destinations without partial writes", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:log",
					itemId: "log",
					location: boardA,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: boardB,
					quantity: 1,
				});

				const duplicate = yield* Effect.either(
					spawnItemFx({
						id: "runtime:log",
						itemId: "log",
						location: inventoryA,
						quantity: 1,
					}),
				);
				const occupied = yield* Effect.either(
					moveItemFx({
						itemId: "runtime:log",
						location: boardB,
					}),
				);
				const log = yield* getItemFx({
					itemId: "runtime:log",
				});
				const stone = yield* getItemAtFx({
					location: boardB,
				});
				const runtime = yield* readRuntimeFx();

				return {
					duplicate,
					log,
					occupied,
					runtime,
					stone,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result.duplicate)).toBe(true);
		if (Either.isLeft(result.duplicate)) {
			expect(result.duplicate.left).toMatchObject({
				_tag: "ItemAlreadyExistsError",
				itemId: "runtime:log",
			});
		}
		expect(Either.isLeft(result.occupied)).toBe(true);
		if (Either.isLeft(result.occupied)) {
			expect(result.occupied.left).toMatchObject({
				_tag: "LocationOccupiedError",
				itemId: "runtime:stone",
				location: boardB,
			});
		}
		expect(result.log.location).toEqual(boardA);
		expect(result.stone.id).toBe("runtime:stone");
		expect(result.runtime.items).toHaveLength(2);
	});
});
