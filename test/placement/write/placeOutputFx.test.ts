import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { placeOutputFx } from "~/v1/placement/write/placeOutputFx";
import {
	boardLocation,
	inventoryLocation,
	placementTestConfig,
} from "~test/placement/fx/support/placementTestConfig";

describe("placeOutputFx", () => {
	it("replaces the origin exactly and keeps its position for later drops", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(2),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "blocker",
					location: boardLocation(3),
					quantity: 1,
				});

				const placement = yield* placeOutputFx({
					originItemId: "runtime:origin",
					output: {
						drop: [
							{
								itemId: "replacement",
								placement: "replace",
								quantity: 1,
							},
							{
								itemId: "log",
								placement: "drop",
								quantity: 1,
							},
						],
					},
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

		expect(result.placement.drop[0]?.placement.remove).toEqual([
			expect.objectContaining({
				id: "runtime:origin",
			}),
		]);
		expect(result.placement.drop[0]?.placement.spawn[0]?.location).toEqual(boardLocation(2));
		expect(result.placement.drop[1]?.placement.spawn[0]?.location).toEqual(boardLocation(1));
		expect(result.runtime.items.some((item) => item.id === "runtime:origin")).toBe(false);
	});

	it("rolls back every earlier drop when a later drop cannot be placed", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:blocker:2",
					itemId: "blocker",
					location: boardLocation(2),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:blocker:3",
					itemId: "blocker",
					location: boardLocation(3),
					quantity: 1,
				});
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
					placeOutputFx({
						originItemId: "runtime:origin",
						output: {
							drop: [
								{
									itemId: "board-only",
									placement: "drop",
									quantity: 1,
								},
								{
									itemId: "board-only",
									placement: "drop",
									quantity: 1,
								},
							],
						},
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
				reason: "board:full",
			});
		}
		expect(result.after).toEqual(result.before);
	});
	it("lets later drops stack into items spawned by earlier drops", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				});

				const placement = yield* placeOutputFx({
					originItemId: "runtime:origin",
					output: {
						drop: [
							{
								itemId: "log",
								placement: "drop",
								quantity: 2,
							},
							{
								itemId: "log",
								placement: "drop",
								quantity: 2,
							},
						],
					},
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

		expect(result.placement.drop[0]?.placement.spawn).toHaveLength(1);
		expect(result.placement.drop[1]?.placement.stack).toEqual([
			{
				item: expect.objectContaining({
					quantity: 3,
				}),
				quantity: 1,
			},
		]);
		expect(result.placement.drop[1]?.placement.spawn).toEqual([
			expect.objectContaining({
				location: boardLocation(2),
				quantity: 1,
			}),
		]);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "log")
				.map((item) => item.quantity),
		).toEqual([
			3,
			1,
		]);
	});
});
