import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

describe("readGameResourceUsagesFn", () => {
	it("counts artwork used only by a production line as an item resource reference", () => {
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				water: {
					...editorTestConfig.items.water,
					lines: [
						{
							uid: "gather",
							title: "Gather",
							description: "Gather water",
							artwork: "line-art",
							runtimeMs: 0,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
						},
					],
				},
			},
		});
		expect(readGameResourceUsagesFn(config)).toContainEqual(
			expect.objectContaining({
				resourceUid: "line-art",
				resourceType: "artwork",
				owner: "item",
				ownerId: "water",
				ownerUid: "water",
				path: [
					"items",
					"water",
					"lines",
					0,
					"artwork",
				],
			}),
		);
	});

	it("projects project and item references with stable owner facts", () => {
		expect(readGameResourceUsagesFn(editorTestConfig)).toEqual([
			{
				resourceUid: "hero",
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
				resourceUid: "item-water",
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
			resourceUid: "theme",
			resourceType: "music",
			roleLabel: "Random playlist track 1",
		});
	});

	it("projects gameplay and presentation SFX assignments as explicit project resource usages", () => {
		const usages = readGameResourceUsagesFn({
			...editorTestConfig,
			sfx: {
				events: {
					"item-detail:opened": "detail-open",
					"job:started": "job-start",
				},
			},
		});

		expect(usages).toContainEqual({
			owner: "project",
			ownerLabel: "Project",
			path: [
				"sfx",
				"events",
				"job:started",
			],
			resourceUid: "job-start",
			resourceType: "sfx",
			roleLabel: "job:started",
		});
		expect(usages).toContainEqual({
			owner: "project",
			ownerLabel: "Project",
			path: [
				"sfx",
				"events",
				"item-detail:opened",
			],
			resourceUid: "detail-open",
			resourceType: "sfx",
			roleLabel: "item-detail:opened",
		});
	});
});
