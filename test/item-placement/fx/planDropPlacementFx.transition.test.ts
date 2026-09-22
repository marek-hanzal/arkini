import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Result, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	boardLocation,
	configuredDrop,
	placementTestConfig,
} from "~test/item-placement/support/placementTestConfig";
import { placeDropForTestFx } from "~test/item-placement/support/placeDropForTestFx";

const requirePlacement = <Value>(value: Value | undefined): Value => {
	expect(value).toBeDefined();
	if (value === undefined) {
		throw new Error("Expected configured drop to be placed.");
	}

	return value;
};

describe("drop placement transition", () => {
	it("does not consume randomness for configured-origin drop placement", () => {
		const nextRandom = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
				});
				yield* placeDropForTestFx({
					drop: configuredDrop({
						itemId: "board-only",
						placement: "drop",
						quantity: 1,
					}),
					originItemId: "runtime:origin",
				});
				return yield* Random.next;
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.75,
					]),
				),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(nextRandom).toBe(0.75);
	});

	it("uses a free random board origin directly", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
				});

				return yield* placeDropForTestFx({
					drop: configuredDrop({
						itemId: "board-only",
						placement: "random",
						quantity: 1,
					}),
					originItemId: "runtime:origin",
				});
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.5,
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

	it("uses a fresh random board origin for every quantity unit in a ranged drop", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
				});
				const placement = yield* placeDropForTestFx({
					drop: {
						...configuredDrop({
							itemId: "board-only",
							placement: "random",
							quantity: 2,
						}),
						quantity: {
							min: 2,
							max: 3,
						},
					},
					originItemId: "runtime:origin",
				});
				const nextRandom = yield* Random.next;

				return {
					nextRandom,
					placement,
				};
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0,
						0.75,
						0.25,
						0.5,
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
				location: boardLocation(3),
			}),
			expect.objectContaining({
				location: boardLocation(1),
			}),
		]);
		expect(result.nextRandom).toBe(0.5);
	});

	it("serializes concurrent drops competing for the last board cell", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
				});
				for (const x of [
					2,
					3,
				]) {
					yield* spawnItemFx({
						id: `runtime:blocker:${x}`,
						itemId: "blocker",
						location: boardLocation(x),
					});
				}
				const drop = configuredDrop({
					itemId: "board-only",
					placement: "drop",
					quantity: 1,
				});
				const attempts = yield* Effect.all(
					[
						Effect.result(
							placeDropForTestFx({
								drop,
								originItemId: "runtime:origin",
							}),
						),
						Effect.result(
							placeDropForTestFx({
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

		expect(result.attempts.filter(Result.isSuccess)).toHaveLength(1);
		expect(result.attempts.filter(Result.isFailure)).toHaveLength(1);
		expect(result.runtime.items.filter((item) => item.item.id === "board-only")).toHaveLength(
			1,
		);
	});
});

it("rejects incomplete placement without committing partial output identities", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "runtime:origin",
				itemId: "origin",
				location: boardLocation(0),
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
				});
			}
			for (const {} of [
				0,
				1,
			]) {
			}
			const before = yield* readRuntimeFx();
			const placement = yield* Effect.result(
				placeDropForTestFx({
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

	expect(Result.isFailure(result.placement)).toBe(true);
	if (Result.isFailure(result.placement)) {
		expect(result.placement.failure).toMatchObject({
			_tag: "PlacementUnavailableError",
			itemId: "log",
			reason: "board:full",
			remainingQuantity: 1,
		});
	}
	expect(result.after).toEqual(result.before);
});
