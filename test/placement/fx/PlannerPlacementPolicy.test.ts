import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { PlannerGamePolicyLayerFx } from "~/engine/game/layer/PlannerGamePolicyLayerFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import { readRuntimeItemDropLocationFx } from "~/engine/placement/fx/readRuntimeItemDropLocationFx";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { boardLocation, placementTestConfig } from "~test/placement/fx/support/placementTestConfig";

const fillBoardFx = Effect.fn("fillPlannerPlacementPolicyBoardFx")(function* () {
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
			id: `runtime:blocker:${x}`,
			itemId: "blocker",
			location: boardLocation(x),
			quantity: 1,
		});
	}
});

describe("planner placement policy", () => {
	it("relaxes finite grid capacity without relaxing scope, quantity or max-stack application", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* fillBoardFx();
				const runtime = yield* readRuntimeFx();
				const drop = {
					itemId: "board-only",
					placement: "drop" as const,
					quantity: 2,
				};
				const canonical = yield* Effect.result(
					planDropPlacementFx({
						drop,
						origin: boardLocation(0),
						runtime,
					}),
				);
				const [placement, plannerRuntime] = yield* applyOutputPlacementFx({
					origin: boardLocation(0),
					output: {
						drop: [
							drop,
						],
					},
					runtime,
				});
				return {
					canonical,
					placement,
					plannerRuntime,
				};
			}).pipe(
				Effect.provide(PlannerGamePolicyLayerFx),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.canonical)).toBe(true);
		if (Result.isFailure(result.canonical)) {
			expect(result.canonical.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "board:full",
				remainingQuantity: 2,
			});
		}
		expect(result.placement.drop[0]?.placement.spawn).toHaveLength(2);
		expect(
			result.placement.drop[0]?.placement.spawn.map((item) => ({
				location: item.location,
				quantity: item.quantity,
			})),
		).toEqual([
			{
				location: boardLocation(4),
				quantity: 1,
			},
			{
				location: boardLocation(5),
				quantity: 1,
			},
		]);
		expect(
			result.plannerRuntime.items
				.filter((item) => item.item.id === "board-only")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(2);
	});

	it("still rejects output that exceeds canonical maxCount", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "limited:existing",
					itemId: "limited",
					location: boardLocation(0),
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();
				return yield* applyOutputPlacementFx({
					origin: boardLocation(0),
					output: {
						drop: [
							{
								itemId: "limited",
								placement: "drop",
								quantity: 2,
							},
						],
					},
					runtime,
				}).pipe(
					Effect.as({
						type: "completed" as const,
					}),
					Effect.catchTag("PlacementUnavailableError", (error) =>
						Effect.succeed({
							error,
							type: "blocked" as const,
						}),
					),
				);
			}).pipe(
				Effect.provide(PlannerGamePolicyLayerFx),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(result.type).toBe("blocked");
		if (result.type === "blocked") {
			expect(result.error.reason).toBe("item:max-count");
		}
	});

	it("returns a stateful identity through unbounded placement without respawning it", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* fillBoardFx();
				const gridRuntime = yield* readRuntimeFx();
				const statefulItem = yield* createRuntimeItemFx({
					id: "runtime:temporary",
					item: placementTestConfig.items["temporary-board-only"],
					location: {
						inputIndex: 0,
						lineId: "line:test",
						ownerItemId: "runtime:origin",
						scope: "input",
					},
					quantity: 1,
				});
				const runtime = {
					...gridRuntime,
					items: [
						...gridRuntime.items,
						statefulItem,
					],
				} satisfies RuntimeSchema.Type;
				const detachedRuntime = {
					...runtime,
					items: runtime.items.filter((item) => item.id !== statefulItem.id),
				} satisfies RuntimeSchema.Type;
				const canonical = yield* Effect.result(
					readRuntimeItemDropLocationFx({
						item: statefulItem,
						origin: boardLocation(0),
						runtime: detachedRuntime,
					}),
				);
				const placed = yield* placeRuntimeItemFx({
					itemId: statefulItem.id,
					origin: boardLocation(0),
					originItemId: "runtime:origin",
					runtime,
				});
				return {
					canonical,
					placed,
					statefulItem,
				};
			}).pipe(
				Effect.provide(PlannerGamePolicyLayerFx),
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.canonical)).toBe(true);
		const placedItems = result.placed.runtime.items.filter(
			(item) => item.id === result.statefulItem.id,
		);
		expect(placedItems).toHaveLength(1);
		expect(placedItems[0]).toMatchObject({
			id: "runtime:temporary",
			location: boardLocation(4),
			quantity: 1,
			remainingDurationMs: 600,
		});
		expect(result.placed.events).toMatchObject([
			{
				type: "item:placed",
				itemId: "runtime:temporary",
				location: boardLocation(4),
			},
		]);
	});
});
