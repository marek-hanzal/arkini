import { describe, expect, it } from "vitest";

import { readGameResourceUsagesFn } from "~/engine/resource/fn/readGameResourceUsagesFn";
import { editorTestConfig } from "~test/editor/support/editorTestPayload";

describe("readGameResourceUsagesFn", () => {
	it("projects project and item references with stable owner facts", () => {
		expect(readGameResourceUsagesFn(editorTestConfig)).toEqual([
			{
				resourceId: "hero",
				owner: "project",
				ownerLabel: "Project",
				roleLabel: "Hero",
				path: [
					"resources",
					"hero",
				],
			},
			{
				resourceId: "item-water",
				owner: "item",
				ownerId: "water",
				ownerUid: "water",
				ownerLabel: "Water",
				roleLabel: "Default artwork 1",
				path: [
					"items",
					"water",
					"asset",
					"default",
					0,
				],
			},
		]);
	});
});
