import { describe, expect, it } from "vitest";

import { convertEditorItemFn } from "~/editor/item/fn/convertEditorItemFn";
import { createEditorItemDraftFn } from "~/editor/item/fn/createEditorItemDraftFn";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

const createItem = (type: (typeof TypeSchema.options)[number]): ItemSchema.Type => ({
	...createEditorItemDraftFn({
		resourceId: "asset:item",
		type,
		uid: "stable-item-uid",
	}),
	title: "Test item",
	description: "A valid item used by conversion tests.",
});

describe("convertEditorItemFn", () => {
	it("produces a valid target for every supported conversion", () => {
		for (const sourceType of TypeSchema.options) {
			for (const targetType of TypeSchema.options) {
				expect(
					ItemSchema.safeParse(convertEditorItemFn(createItem(sourceType), targetType))
						.success,
				).toBe(true);
			}
		}
	});

	it("preserves a craft line when promoted to a producer", () => {
		const craft = createItem("craft");
		if (craft.type !== "craft") throw new Error("Expected craft fixture.");
		const producer = convertEditorItemFn(craft, "producer");

		expect(producer.type).toBe("producer");
		if (producer.type !== "producer") throw new Error("Expected producer conversion.");
		expect(producer.lines).toEqual([
			craft.line,
		]);
		expect(producer.id).toBe(craft.id);
		expect(producer.uid).toBe(craft.uid);
	});

	it("keeps the first producer line when converted to a single-line type", () => {
		const producer = createItem("producer");
		if (producer.type !== "producer") throw new Error("Expected producer fixture.");
		const secondLine = {
			...producer.lines[0],
			id: "line:second",
			title: "Second line",
		};
		const source = {
			...producer,
			lines: [
				producer.lines[0],
				secondLine,
			] as [
				LineSchema.Type,
				LineSchema.Type,
			],
		};
		const craft = convertEditorItemFn(source, "craft");

		expect(craft.type).toBe("craft");
		if (craft.type !== "craft") throw new Error("Expected craft conversion.");
		expect(craft.line).toEqual(producer.lines[0]);
	});

	it("trims specialized fields when converted to a simple item", () => {
		const producer = createItem("producer");
		const simple = convertEditorItemFn(producer, "simple");

		expect(simple).toMatchObject({
			id: producer.id,
			type: "simple",
			uid: producer.uid,
		});
		expect("lines" in simple).toBe(false);
		expect("maxQueueSize" in simple).toBe(false);
	});

	it("enforces target invariants while retaining shared data", () => {
		const simpleDraft = createItem("simple");
		if (simpleDraft.type !== "simple") throw new Error("Expected simple fixture.");
		const simple = {
			...simpleDraft,
			maxCount: 9,
			maxStackSize: 20,
			scope: "inventory" as const,
		};
		const inventory = convertEditorItemFn(simple, "inventory");

		expect(inventory).toMatchObject({
			maxCount: 1,
			maxStackSize: 1,
			scope: "board",
			title: simple.title,
			type: "inventory",
		});
	});
});
