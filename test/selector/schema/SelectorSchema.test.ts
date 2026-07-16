import { describe, expect, it } from "vitest";

import { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

describe("SelectorSchema", () => {
	it("selects items either directly or by their semantic tag", () => {
		expect(
			SelectorSchema.safeParse({
				type: "item",
				itemId: "tree",
			}).success,
		).toBe(true);
		expect(
			SelectorSchema.safeParse({
				type: "tag",
				tag: "forest",
			}).success,
		).toBe(true);
	});

	it("rejects fields from a different selector strategy", () => {
		expect(
			SelectorSchema.safeParse({
				type: "tag",
				itemId: "tree",
			}).success,
		).toBe(false);
	});
});
