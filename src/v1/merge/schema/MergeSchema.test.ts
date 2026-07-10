import { describe, expect, it } from "vitest";

import { MergeSchema } from "./MergeSchema";

describe("MergeSchema", () => {
	it("defines a target-specific transform or removal action for a merge source", () => {
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				result: "tree",
				action: "use",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "tag",
					tag: "tree",
				},
				result: "tree",
				action: "consume",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "consume",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				result: "tree",
				action: "replace",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				action: "consume",
			}).success,
		).toBe(false);
	});
});
