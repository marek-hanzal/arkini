import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { planDropScopePlacementFx } from "~/v1/placement/fx/planDropScopePlacementFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import {
	boardLocation,
	inventoryLocation,
	placementTestConfig,
} from "~test/placement/fx/support/placementTestConfig";

const runtimeItem = ({
	id,
	itemId,
	location,
	quantity,
}: {
	id: string;
	itemId: keyof typeof placementTestConfig.items;
	location: RuntimeItemSchema.Type["location"];
	quantity: number;
}) => {
	return {
		id,
		item: placementTestConfig.items[itemId],
		location,
		quantity,
		revision: `revision:${id}`,
	} satisfies RuntimeItemSchema.Type;
};

const run = <A, E>(effect: Effect.Effect<A, E, GameConfigFx>) => {
	return Effect.runSync(effect.pipe(Effect.provideService(GameConfigFx, placementTestConfig)));
};

describe("planDropScopePlacementFx", () => {
	it("keeps board-only placement on the board and reports board capacity", () => {
		const runtime = {
			items: [
				runtimeItem({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				}),
				...[
					1,
					2,
					3,
				].map((x) => {
					return runtimeItem({
						id: `runtime:blocker:${x}`,
						itemId: "blocker",
						location: boardLocation(x),
						quantity: 1,
					});
				}),
			],
		} satisfies RuntimeSchema.Type;

		const result = run(
			Effect.either(
				planDropScopePlacementFx({
					drop: {
						itemId: "board-only",
						placement: "drop",
						quantity: 1,
					},
					item: placementTestConfig.items["board-only"],
					origin: {
						x: 0,
						y: 0,
					},
					quantity: 1,
					runtime,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "board:full",
				remainingQuantity: 1,
			});
		}
	});

	it("routes inventory-only placement directly to inventory", () => {
		const runtime = {
			items: [
				runtimeItem({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				}),
				runtimeItem({
					id: "runtime:inventory-item",
					itemId: "inventory-only",
					location: inventoryLocation(1),
					quantity: 1,
				}),
			],
		} satisfies RuntimeSchema.Type;

		const plan = run(
			planDropScopePlacementFx({
				drop: {
					itemId: "inventory-only",
					placement: "random",
					quantity: 3,
				},
				item: placementTestConfig.items["inventory-only"],
				origin: {
					x: 0,
					y: 0,
				},
				quantity: 3,
				runtime,
			}),
		);

		expect(plan.stack).toEqual([
			{
				itemId: "runtime:inventory-item",
				quantity: 1,
			},
		]);
		expect(plan.spawn).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					location: inventoryLocation(0),
					quantity: 2,
				}),
			}),
		]);
	});

	it("plans board first and sends only the remainder to inventory for any-scope items", () => {
		const runtime = {
			items: [
				runtimeItem({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(0),
					quantity: 1,
				}),
				runtimeItem({
					id: "runtime:log",
					itemId: "log",
					location: boardLocation(1),
					quantity: 2,
				}),
				runtimeItem({
					id: "runtime:blocker",
					itemId: "blocker",
					location: boardLocation(3),
					quantity: 1,
				}),
			],
		} satisfies RuntimeSchema.Type;

		const plan = run(
			planDropScopePlacementFx({
				drop: {
					itemId: "log",
					placement: "drop",
					quantity: 5,
				},
				item: placementTestConfig.items.log,
				origin: {
					x: 0,
					y: 0,
				},
				quantity: 5,
				runtime,
			}),
		);

		expect(plan.stack).toEqual([
			{
				itemId: "runtime:log",
				quantity: 1,
			},
		]);
		expect(plan.spawn).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					location: boardLocation(2),
					quantity: 3,
				}),
			}),
			expect.objectContaining({
				item: expect.objectContaining({
					location: inventoryLocation(0),
					quantity: 1,
				}),
			}),
		]);
	});
});
