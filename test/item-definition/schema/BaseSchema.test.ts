import { describe, expect, it } from "vitest";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";

describe("ItemSchema defaults", () => {
	it("defaults an omitted item interface to simple", () => {
		const item = ItemSchema.parse({
			maxQueueSize: 1,
			lines: [],
			uid: "simple-item",
			id: "simple-item",
			title: "Simple item",
			artwork: {
				scale: 0.8,
				default: [
					"simple-item",
				],
			},
		});

		expect(item.ui).toBe("simple");
	});

	it("accepts an omitted persisted draft status and resolves it as false", () => {
		const item = ItemSchema.parse({
			maxQueueSize: 1,
			lines: [],

			uid: "legacy-item",
			id: "legacy-item",
			title: "Legacy item",
			artwork: {
				scale: 0.8,
				default: [
					"legacy-item",
				],
			},
		});

		expect(item.draft).toBeUndefined();
		expect(readDraftFn(item)).toBe(false);
	});
});
