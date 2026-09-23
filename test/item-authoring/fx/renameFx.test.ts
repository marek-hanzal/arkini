import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { renameFx } from "~/item-authoring/fx/renameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

describe("renameFx", () => {
	it("renames template placements without changing template identity or dimensions", () => {
		const template = {
			uid: "template",
			title: "Template",
			width: 8,
			height: 3,
			board: [
				{
					x: 7,
					y: 2,
					itemId: "water",
				},
			],
		};
		const result = Effect.runSync(
			renameFx({
				config: {
					...editorTestConfig,
					templates: [
						template,
					],
				},
				itemId: "water",
				newItemId: "fresh-water",
			}),
		);
		expect(result.config.templates).toEqual([
			{
				...template,
				board: [
					{
						x: 7,
						y: 2,
						itemId: "fresh-water",
					},
				],
			},
		]);
		expect(result.updatedReferencePaths).toContainEqual([
			"templates",
			0,
			"board",
			0,
			"itemId",
		]);
	});
	it("rewrites Clock timer rules and expiry outcome without changing its line identities", () => {
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				...editorTestConfig.items,
				clock: {
					...createProducerItem({
						id: "clock",
					}),
					clock: {
						intervalMs: 1000,
						rules: [
							{
								type: "enable",
								when: [
									{
										type: "exists",
										query: {
											distance: "far",
											selector: {
												type: "item",
												itemId: "water",
											},
										},
									},
								],
							},
						],
						onExpire: createOutput([
							{
								itemId: "water",
							},
						]),
					},
				},
			},
		});
		const result = Effect.runSync(
			renameFx({
				config,
				itemId: "water",
				newItemId: "fresh-water",
			}),
		);
		expect(result.config.items.clock).toMatchObject({
			clock: {
				rules: [
					{
						when: [
							{
								query: {
									distance: "far",
									selector: {
										itemId: "fresh-water",
									},
								},
							},
						],
					},
				],
			},
		});
		expect(result.updatedReferencePaths).toContainEqual([
			"items",
			"clock",
			"clock",
			"onExpire",
			"set",
			0,
			"roll",
			0,
			"outcome",
			0,
			"itemId",
		]);
		expect(JSON.stringify(result.config.items.clock)).not.toContain('"water"');
		expect(result.config.items.clock).toHaveProperty(
			"lines",
			(
				config.items.clock as {
					lines: unknown;
				}
			).lines,
		);
	});

	it("rewrites exact references across start, selectors, inputs, and outputs", () => {
		const outcome = createOutput([
			{
				itemId: "water",
			},
		]);
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				water: editorTestConfig.items.water,
				oil: {
					...createSimpleItem("oil"),
					merge: [
						{
							action: "use",
							effect: "keep",
							target: {
								type: "item",
								itemId: "water",
							},
						},
					],
					units: {
						amount: 1,
						outcome,
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "water-line",
							input: [
								{
									mode: "consume",
									type: "materials",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemId: "water",
										},
									},
									quantity: {
										min: 1,
										max: 1,
									},
								},
							],
							outcome,
						}),
					],
				}),
			},
		});

		const result = Effect.runSync(
			renameFx({
				config,
				itemId: "water",
				newItemId: "fresh-water",
			}),
		);

		expect(result.config.items["fresh-water"]).toMatchObject({
			id: "fresh-water",
			uid: "water",
		});
		expect(result.config.start.board[0]?.itemId).toBe("fresh-water");
		expect(JSON.stringify(result.config.items.oil)).not.toContain('"water"');
		expect(JSON.stringify(result.config.items.producer)).not.toContain('"water"');
		expect(result.updatedReferencePaths).toHaveLength(5);
		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
	});
});
