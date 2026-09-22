import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { assertPlacementPlanCompleteFx } from "~/item-placement/fx/assertPlacementPlanCompleteFx";
import {
	placementTestConfig,
	boardLocation,
} from "~test/item-placement/support/placementTestConfig";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";

const drop = {
	type: "item" as const,
	itemId: "item:test",
	placement: "drop" as const,
	quantity: 2,
};

const plan = (quantity: number) =>
	({
		spawn: Array.from(
			{
				length: quantity,
			},
			(_, index) => ({
				id: `spawn-${index}`,
				item: placementTestConfig.items.log,
				revision: `revision-${index}`,
				location: boardLocation(index),
			}),
		),
	}) satisfies PlacementPlan;

const assert = (quantity: number) =>
	Effect.runSync(
		Effect.result(
			assertPlacementPlanCompleteFx({
				drop,
				plan: plan(quantity),
				quantity: drop.quantity,
				reason: "board:full",
			}),
		),
	);

describe("assertPlacementPlanCompleteFx", () => {
	it("accepts an exact placement quantity", () => {
		expect(Result.isSuccess(assert(2))).toBe(true);
	});

	it("reports partial placement as unavailable capacity", () => {
		expect(assert(1)).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "PlacementUnavailableError",
				remainingQuantity: 1,
			},
		});
	});

	it("reports over-placement as an invalid planner result", () => {
		expect(assert(3)).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "PlacementPlanInvalidError",
				requestedQuantity: 2,
				placedQuantity: 3,
			},
		});
	});
});
