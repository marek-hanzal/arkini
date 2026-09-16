import { describe, expect, it } from "vitest";

import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

describe("readGameResourceUsagesFn", () => {
	it("projects project and item references with stable owner facts", () => {
		expect(readGameResourceUsagesFn(editorTestConfig)).toEqual([
			{
				resourceId: "hero",
				resourceType: "image",
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
				resourceType: "artwork",
				owner: "item",
				ownerId: "water",
				ownerUid: "water",
				ownerLabel: "Water",
				roleLabel: "Default artwork 1",
				path: [
					"items",
					"water",
					"artwork",
					"default",
					0,
				],
			},
		]);
	});

	it("projects random playlist Music as an explicit project resource usage", () => {
		expect(
			readGameResourceUsagesFn({
				...editorTestConfig,
				music: {
					playlist: [
						"theme",
					],
				},
			}),
		).toContainEqual({
			owner: "project",
			ownerLabel: "Project",
			path: [
				"music",
				"playlist",
				0,
			],
			resourceId: "theme",
			resourceType: "music",
			roleLabel: "Random playlist track 1",
		});
	});
});
