import { describe, expect, it } from "vitest";

import { CategorySchema } from "./CategorySchema";

describe("CategorySchema", () => {
	it("requires a stable ID and display title", () => {
		expect(
			CategorySchema.safeParse({
				id: "resource",
				title: "Resources",
			}).success,
		).toBe(true);
		expect(
			CategorySchema.safeParse({
				id: "",
				title: "Resources",
			}).success,
		).toBe(false);
	});
});
