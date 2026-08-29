import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { editorTestConfig } from "~test/editor/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config/validation/support/gameValidationTestSource";
import { renameEditorItemFx } from "~/item-authoring/domain/fx/renameEditorItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";

describe("renameEditorItemFx", () => {
	it("rewrites exact references across start, selectors, inputs, and outputs", () => {
		const output = createOutput([
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
					charges: {
						amount: 1,
						output,
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "water-line",
							input: [
								{
									capacity: 0,
									mode: "consume",
									type: "materials",
									selector: {
										type: "item",
										itemId: "water",
									},
									quantity: {
										min: 1,
										max: 1,
									},
								},
							],
							output,
						}),
					],
				}),
			},
		});

		const result = Effect.runSync(
			renameEditorItemFx({
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
