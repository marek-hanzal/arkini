import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { GameEventSchema } from "~/engine/event/schema/GameEventSchema";

const location = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
};

describe("item lifecycle game events", () => {
	it("accepts exact surviving charge-spend and explicit-removal facts", () => {
		const chargeSpent = {
			type: GameEventEnumSchema.enum.ItemChargeSpent,
			itemId: "runtime:charged",
			canonicalItemId: "deposit:tree",
			location,
			previousCharges: 3,
			resultingCharges: 2,
		};
		const explicitlyRemoved = {
			type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
			itemId: "runtime:removed",
			canonicalItemId: "producer:forge",
			location,
			quantity: 1,
		};

		expect(GameEventSchema.parse(chargeSpent)).toEqual(chargeSpent);
		expect(GameEventSchema.parse(explicitlyRemoved)).toEqual(explicitlyRemoved);
	});

	it("rejects terminal or non-decreasing charge spends", () => {
		for (const resultingCharges of [
			0,
			3,
			4,
		]) {
			expect(
				GameEventSchema.safeParse({
					type: GameEventEnumSchema.enum.ItemChargeSpent,
					itemId: "runtime:charged",
					canonicalItemId: "deposit:tree",
					location,
					previousCharges: 3,
					resultingCharges,
				}).success,
			).toBe(false);
		}
	});
});
