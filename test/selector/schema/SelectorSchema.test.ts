import { describe, expect, it } from "vitest";

import { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

describe("SelectorSchema", () => {
	it("selects one item directly by stable ID", () => {
		expect(
			SelectorSchema.safeParse({
				type: "item",
				itemId: "tree",
			}).success,
		).toBe(true);
	});
});
