import { describe, expect, it } from "vitest";

import { CommonSchema } from "~/item-definition/schema/CommonSchema";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";

describe("BaseSchema draft status", () => {
	it("accepts an omitted persisted draft status and resolves it as false", () => {
		const item = CommonSchema.parse({
			maxQueueSize: 1,
			lines: [],

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
			maxStackSize: 1,
			type: "common",
		});

		expect(item.draft).toBeUndefined();
		expect(readDraftFn(item)).toBe(false);
	});
});
