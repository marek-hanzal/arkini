import { describe, expect, it } from "vitest";

import { DropSchema } from "~/engine/output/schema/DropSchema";

const drop = (placement?: string) => ({
	itemId: "item:log",
	quantity: {
		type: "value" as const,
		value: 1,
	},
	...(placement === undefined
		? {}
		: {
				placement,
			}),
	rules: [],
});

describe("DropSchema", () => {
	it("defaults resolved drops to the local board-placement strategy", () => {
		expect(DropSchema.parse(drop()).placement).toBe("drop");
	});

	it("accepts random placement and rejects removed lifecycle placement values", () => {
		expect(DropSchema.safeParse(drop("random")).success).toBe(true);
		expect(DropSchema.safeParse(drop("replace")).success).toBe(false);
		expect(DropSchema.safeParse(drop("anywhere")).success).toBe(false);
	});
});
