import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readGameResourceUsagesFx } from "~/engine/resource/readGameResourceUsagesFx";
import { editorTestConfig } from "~test/editor/support/editorTestPayload";

describe("readGameResourceUsagesFx", () => {
	it("projects project and item references with stable owner facts", () => {
		expect(Effect.runSync(readGameResourceUsagesFx(editorTestConfig))).toEqual([
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
