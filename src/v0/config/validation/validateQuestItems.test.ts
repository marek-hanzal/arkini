import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";

const createQuestItem = (outputItemId: string) => ({
	assetIds: [
		"asset:test",
	],
	craft: {
		durationMs: 1000,
		inputs: [
			{
				consume: true,
				itemId: "item:twig",
				quantity: 1,
			},
		],
		output: [
			{
				entries: [
					{
						itemId: outputItemId,
						type: "guaranteed" as const,
					},
				],
			},
		],
	},
	description: "Quest",
	maxStackSize: 1,
	name: "Quest",
	storage: "both" as const,
	tags: [
		"quest",
		"craft-target",
	],
	tier: 0,
});

describe("validateQuestItems", () => {
	it("allows quest craft targets with modest non-blueprint rewards", () => {
		expect(() =>
			createEngineTestConfig({
				items: {
					"item:quest:test": createQuestItem("item:plank"),
				},
			}),
		).not.toThrow();
	});

	it("rejects quest rewards that hand out blueprints", () => {
		expect(() =>
			createEngineTestConfig({
				items: {
					"item:blueprint-test": {
						assetIds: [
							"asset:test",
						],
						description: "Blueprint",
						maxStackSize: 1,
						name: "Blueprint",
						tags: [
							"blueprint",
						],
						tier: 0,
					},
					"item:quest:test": createQuestItem("item:blueprint-test"),
				},
			}),
		).toThrow(/must not reward blueprint/);
	});

	it("rejects quests that take the same item they reward", () => {
		expect(() =>
			createEngineTestConfig({
				items: {
					"item:quest:test": createQuestItem("item:twig"),
				},
			}),
		).toThrow(/must not take the same item/);
	});
});
