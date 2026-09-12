import { describe, expect, it } from "vitest";

import { convertFn } from "~/item-authoring/fn/convertFn";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

const createItem = (type: (typeof TypeSchema.options)[number]): ItemSchema.Type => ({
	...createDraftFn({
		resourceId: "asset:item",
		type,
		uid: "stable-item-uid",
	}),
	title: "Test item",
	description: "A valid item used by conversion tests.",
});

describe("convertFn", () => {
	it("produces a valid target for every supported conversion", () => {
		for (const sourceType of TypeSchema.options)
			for (const targetType of TypeSchema.options)
				expect(
					ItemSchema.safeParse(convertFn(createItem(sourceType), targetType)).success,
				).toBe(true);
	});
	it("keeps passive Common conversions empty", () => {
		const inventory = createItem("inventory");
		expect(convertFn(inventory, "common")).toMatchObject({
			type: "common",
			lines: [],
			maxQueueSize: 1,
		});
	});
	it("enforces target invariants while retaining shared data", () => {
		const draft = createItem("common");
		if (draft.type !== "common") throw new Error("Expected Common fixture.");
		const common = {
			...draft,
			maxCount: 9,
			maxStackSize: 20,
			scope: "inventory" as const,
		};
		expect(convertFn(common, "inventory")).toMatchObject({
			maxCount: 1,
			maxStackSize: 1,
			scope: "board",
			title: common.title,
			type: "inventory",
		});
	});
});
