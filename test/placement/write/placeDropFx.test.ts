import { Effect, Either, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { placeDropFx } from "~/engine/placement/write/placeDropFx";
import {
	boardLocation,
	configuredDrop,
	inventoryLocation,
	placementTestConfig,
} from "~test/placement/fx/support/placementTestConfig";

const requirePlacement = <Value>(value: Value | undefined): Value => {
	expect(value).toBeDefined();
	if (value === undefined) {
		throw new Error("Expected configured drop to be placed.");
	}

	return value;
};

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
					drop: configuredDrop({
						itemId: "log",
						placement: "drop",
						quantity: 5,
					}),
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

		const placement = requirePlacement(result.placement);

		expect(placement.placement.stack).toEqual([
			{
				item: expect.objectContaining({
					id: "runtime:log",
					quantity: 3,
				}),
				quantity: 1,
			},
		]);
		expect(placement.placement.spawn).toEqual([
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
					drop: configuredDrop({
						itemId: "inventory-only",
						placement: "random",
						quantity: 3,
					}),
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

		const placement = requirePlacement(result.placement);

		expect(placement.placement.stack).toEqual([
			{
				item: expect.objectContaining({
					id: "runtime:inventory-item",
					quantity: 2,
				}),
				quantity: 1,
			},
		]);
		expect(placement.placement.spawn).toEqual([
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
						drop: configuredDrop({
							itemId: "log",
							placement: "drop",
							quantity: 1,
						}),
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
						drop: configuredDrop({
							itemId: "limited",
							placement: "drop",
							quantity: 1,
						}),
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
	it("uses a free random board origin directly", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});

				return yield* placeDropFx({
					drop: configuredDrop({
						itemId: "board-only",
						placement: "random",
						quantity: 1,
					}),
					originItemId: "runtime:origin",
				});
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						2,
					]),
				),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		const placement = requirePlacement(result);

		expect(placement.placement.spawn).toEqual([
			expect.objectContaining({
				location: boardLocation(2),
			}),
		]);
	});

	it("uses one occupied random origin for the complete standard placement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "blocker",
					location: boardLocation(2),
					quantity: 1,
				});

				const placement = yield* placeDropFx({
					drop: configuredDrop({
						itemId: "board-only",
						placement: "random",
						quantity: 2,
					}),
					originItemId: "runtime:origin",
				});
				const nextRandom = yield* Random.next;

				return {
					nextRandom,
					placement,
				};
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						2,
						0.75,
					]),
				),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		const placement = requirePlacement(result.placement);

		expect(placement.placement.spawn).toEqual([
			expect.objectContaining({
				location: boardLocation(1),
			}),
			expect.objectContaining({
				location: boardLocation(3),
			}),
		]);
		expect(result.nextRandom).toBe(0.75);
	});

	it("orders stack-first placement around the random origin", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:log:left",
					itemId: "log",
					location: boardLocation(1),
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:log:right",
					itemId: "log",
					location: boardLocation(3),
					quantity: 2,
				});

				return yield* placeDropFx({
					drop: configuredDrop({
						itemId: "log",
						placement: "random",
						quantity: 1,
					}),
					originItemId: "runtime:origin",
				});
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						3,
					]),
				),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		const placement = requirePlacement(result);

		expect(placement.placement.stack).toEqual([
			{
				item: expect.objectContaining({
					id: "runtime:log:right",
					quantity: 3,
				}),
				quantity: 1,
			},
		]);
	});

	it("uses random board placement only after stack capacity is exhausted", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});

				return yield* placeDropFx({
					drop: configuredDrop({
						itemId: "log",
						placement: "random",
						quantity: 1,
					}),
					originItemId: "runtime:origin",
				});
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		const placement = requirePlacement(result);

		expect(placement.placement.stack).toEqual([]);
		expect(placement.placement.spawn).toHaveLength(1);
		const spawned = placement.placement.spawn[0];
		expect(spawned?.location.scope).toBe("board");
		if (spawned?.location.scope !== "board") {
			throw new Error("Expected one board placement.");
		}
		expect([
			1,
			2,
			3,
		]).toContain(spawned.location.position.x);
	});

	it("serializes concurrent drops competing for the last board cell", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				for (const x of [
					2,
					3,
				]) {
					yield* spawnItemFx({
						id: `runtime:blocker:${x}`,
						itemId: "blocker",
						location: boardLocation(x),
						quantity: 1,
					});
				}
				const drop = configuredDrop({
					itemId: "board-only",
					placement: "drop",
					quantity: 1,
				});
				const attempts = yield* Effect.all(
					[
						Effect.either(
							placeDropFx({
								drop,
								originItemId: "runtime:origin",
							}),
						),
						Effect.either(
							placeDropFx({
								drop,
								originItemId: "runtime:origin",
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
					config: placementTestConfig,
				}),
			),
		);

		expect(result.attempts.filter(Either.isRight)).toHaveLength(1);
		expect(result.attempts.filter(Either.isLeft)).toHaveLength(1);
		expect(result.runtime.items.filter((item) => item.item.id === "board-only")).toHaveLength(
			1,
		);
	});
});
