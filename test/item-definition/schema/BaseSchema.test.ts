import { describe, expect, it } from "vitest";

import { SimpleSchema } from "~/item-definition/schema/SimpleSchema";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";

describe("BaseSchema draft status", () => {
	it("accepts an omitted persisted draft status and resolves it as false", () => {
		const item = SimpleSchema.parse({
			uid: "legacy-item",
			id: "legacy-item",
			title: "Legacy item",
			asset: {
				scale: 0.8,
				default: [
					"legacy-item",
				],
			},
			scope: "any",
			layer: "content",
			maxStackSize: 1,
			type: "simple",
		});

		expect(item.draft).toBeUndefined();
		expect(readDraftFn(item)).toBe(false);
	});
});
