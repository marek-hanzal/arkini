import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { getItemAtFx } from "~/v1/runtime/read/getItemAtFx";
import { getItemFx } from "~/v1/runtime/read/getItemFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { moveItemFx } from "~/v1/runtime/write/moveItemFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { setItemQuantityFx } from "~/v1/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { swapItemsFx } from "~/v1/runtime/write/swapItemsFx";

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
	it("serializes concurrent spawns competing for one location", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const attempts = yield* Effect.all(
					[
						Effect.either(
							spawnItemFx({
								id: "runtime:log",
								itemId: "log",
								location: boardA,
								quantity: 1,
							}),
						),
						Effect.either(
							spawnItemFx({
								id: "runtime:stone",
								itemId: "stone",
								location: boardA,
								quantity: 1,
							}),
						),
					],
					{
						concurrency: "unbounded",
					},
				);
				const runtime = yield* readRuntimeFx();

				return {
					attempts,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempts.filter(Either.isRight)).toHaveLength(1);
		expect(result.attempts.filter(Either.isLeft)).toHaveLength(1);
		expect(result.runtime.items).toHaveLength(1);
		expect(result.runtime.items[0]?.location).toEqual(boardA);
	});

	it("serializes concurrent moves competing for one location", async () => {
		const target = {
			scope: "board" as const,
			position: {
				x: 2,
				y: 0,
			},
		};
		const result = await Effect.runPromise(
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
				const attempts = yield* Effect.all(
					[
						Effect.either(
							moveItemFx({
								itemId: "runtime:log",
								location: target,
							}),
						),
						Effect.either(
							moveItemFx({
								itemId: "runtime:stone",
								location: target,
							}),
						),
					],
					{
						concurrency: "unbounded",
					},
				);
				const runtime = yield* readRuntimeFx();

				return {
					attempts,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempts.filter(Either.isRight)).toHaveLength(1);
		expect(result.attempts.filter(Either.isLeft)).toHaveLength(1);
		expect(result.runtime.items.filter((item) => item.location.scope === "board")).toHaveLength(
			2,
		);
		expect(
			result.runtime.items.filter((item) => {
				return (
					item.location.scope === target.scope &&
					item.location.position.x === target.position.x &&
					item.location.position.y === target.position.y
				);
			}),
		).toHaveLength(1);
	});

	it("serializes concurrent removals of one item", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:log",
					itemId: "log",
					location: boardA,
					quantity: 1,
				});
				const attempts = yield* Effect.all(
					[
						Effect.either(
							removeItemFx({
								itemId: "runtime:log",
							}),
						),
						Effect.either(
							removeItemFx({
								itemId: "runtime:log",
							}),
						),
					],
					{
						concurrency: "unbounded",
					},
				);
				const runtime = yield* readRuntimeFx();

				return {
					attempts,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempts.filter(Either.isRight)).toHaveLength(1);
		expect(result.attempts.filter(Either.isLeft)).toHaveLength(1);
		expect(result.runtime.items).toEqual([]);
	});
});
