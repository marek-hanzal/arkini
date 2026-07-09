import { describe, expect, it } from "vitest";

import { MergeSchema } from "./MergeSchema";

describe("MergeSchema", () => {
	it("defines a directional transform or removal action for a merge source", () => {
		expect(
			MergeSchema.safeParse({
				result: "tree",
				action: "use",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				result: "tree",
				action: "consume",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				action: "consume",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				result: "tree",
				action: "replace",
			}).success,
		).toBe(false);
	});
});
