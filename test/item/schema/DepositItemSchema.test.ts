import { describe, expect, it } from "vitest";

import { DepositItemSchema } from "~/v1/item/schema/DepositItemSchema";

describe("DepositItemSchema", () => {
	it("requires a positive initial use count", () => {
		expect(DepositItemSchema.shape.count.safeParse(1).success).toBe(true);
		expect(DepositItemSchema.shape.count.safeParse(0).success).toBe(false);
	});
});
