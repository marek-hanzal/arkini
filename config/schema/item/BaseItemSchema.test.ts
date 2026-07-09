import { describe, expect, it } from "vitest";

import { BaseItemSchema } from "./BaseItemSchema";
import { SimpleItemSchema } from "./SimpleItemSchema";

describe("BaseItemSchema", () => {
	it("requires storage scope and permits an optional positive total limit", () => {
		const item = {
			id: "tree",
			scope: "board",
		};

		expect(BaseItemSchema.safeParse(item).success).toBe(true);
		expect(
			BaseItemSchema.safeParse({
				...item,
				maxCount: 0,
			}).success,
		).toBe(false);
	});

	it("requires a positive stack limit only for simple items", () => {
		const item = {
			id: "tree",
			scope: "board",
			type: "simple",
			maxStackSize: 1,
		};

		expect(SimpleItemSchema.safeParse(item).success).toBe(true);
		expect(
			SimpleItemSchema.safeParse({
				...item,
				maxStackSize: 0,
			}).success,
		).toBe(false);
	});
});
