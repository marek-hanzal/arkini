import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { assertPlacementPlanCompleteFx } from "~/v1/placement/fx/assertPlacementPlanCompleteFx";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";

const drop = {
	itemId: "item:test",
	placement: "drop" as const,
	quantity: 2,
};

const plan = (quantity: number) =>
	({
		remove: [],
		spawn: [],
		stack: [
			{
				itemId: "runtime:stack",
				quantity,
			},
		],
	}) satisfies PlacementPlanSchema.Type;

const assert = (quantity: number) =>
	Effect.runSync(
		Effect.either(
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
		expect(Either.isRight(assert(2))).toBe(true);
	});

	it("reports partial placement as unavailable capacity", () => {
		expect(assert(1)).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "PlacementUnavailableError",
				remainingQuantity: 1,
			},
		});
	});

	it("reports over-placement as an invalid planner result", () => {
		expect(assert(3)).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "PlacementPlanInvalidError",
				requestedQuantity: 2,
				placedQuantity: 3,
			},
		});
	});
});
