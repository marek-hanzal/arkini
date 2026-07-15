import { describe, expect, it } from "vitest";

import { QuerySchema } from "~/v1/query/schema/QuerySchema";

describe("QuerySchema", () => {
	it("requires distance only for board queries", () => {
		expect(
			QuerySchema.safeParse({
				scope: "board",
				distance: "near",
				selector: {
					type: "tag",
					tag: "wood-source",
				},
			}).success,
		).toBe(true);
		expect(
			QuerySchema.safeParse({
				scope: "board",
				selector: {
					type: "tag",
					tag: "wood-source",
				},
			}).success,
		).toBe(false);
	});

	it("forbids distance for inventory, local combined, and universe queries", () => {
		for (const scope of [
			"inventory",
			"any",
			"universe",
		]) {
			expect(
				QuerySchema.safeParse({
					scope,
					selector: {
						type: "item",
						itemId: "item:water",
					},
				}).success,
			).toBe(true);
			expect(
				QuerySchema.safeParse({
					scope,
					distance: "near",
					selector: {
						type: "item",
						itemId: "item:water",
					},
				}).success,
			).toBe(false);
		}
	});
});
