import { describe, expect, it } from "vitest";
import { isStatefulInventoryState } from "~/v0/inventory/logic/isStatefulInventoryState";

describe("isStatefulInventoryState", () => {
	it("treats empty or missing state as stackable", () => {
		expect(isStatefulInventoryState(undefined)).toBe(false);
		expect(isStatefulInventoryState({})).toBe(false);
	});

	it("treats any persisted state key as stateful", () => {
		expect(
			isStatefulInventoryState({
				activation: {
					remainingCharges: 1,
				},
			}),
		).toBe(true);
	});
});
