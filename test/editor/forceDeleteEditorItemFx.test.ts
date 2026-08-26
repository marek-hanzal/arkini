import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { forceDeleteEditorItemFx } from "~/editor/forceDeleteEditorItemFx";
import { editorTestConfig } from "~test/editor/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const waterOutput = createOutput([
	{
		itemId: "water",
	},
]);

describe("forceDeleteEditorItemFx", () => {
	it("removes every directly referencing structure and keeps unrelated authoring intact", () => {
		const oil = createSimpleItem("oil");
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			start: {
				...editorTestConfig.start,
				inventory: [
					{
						itemId: "water",
						position: {
							x: 0,
							y: 0,
						},
						quantity: 2,
					},
				],
			},
			items: {
				water: editorTestConfig.items.water,
				oil: {
					...oil,
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
						output: waterOutput,
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "water-line",
							output: waterOutput,
						}),
						createLine({
							id: "oil-line",
							output: createOutput([
								{
									itemId: "oil",
								},
							]),
						}),
					],
				}),
			},
		});

		const result = Effect.runSync(
			forceDeleteEditorItemFx({
				config,
				itemId: "water",
			}),
		);

		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
		expect(result.config.items.water).toBeUndefined();
		expect(result.config.start.board).toEqual([]);
		expect(result.config.start.inventory).toEqual([]);
		expect(result.config.items.oil).toMatchObject({
			charges: {
				amount: 1,
			},
		});
		expect(result.config.items.oil?.merge).toBeUndefined();
		expect(result.config.items.producer).toMatchObject({
			lines: [
				{
					id: "oil-line",
				},
			],
		});
		expect(result.impact).toEqual({
			deletedOwnerItemIds: [],
			removedChargeOutputOwnerIds: [
				"oil",
			],
			removedExpiryOutputOwnerIds: [],
			removedLines: [
				{
					ownerItemId: "producer",
					lineId: "water-line",
					title: "water-line",
				},
			],
			removedMergeRules: [
				{
					ownerItemId: "oil",
					ruleNumber: 1,
				},
			],
			removedStartEntries: {
				board: 1,
				inventory: 1,
				toolbar: 0,
			},
		});
	});

	it("deletes an owner whose required production structure references the item", () => {
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			start: {
				...editorTestConfig.start,
				board: [],
			},
			items: {
				...editorTestConfig.items,
				producer: createProducerItem({
					id: "producer",
					output: waterOutput,
				}),
			},
		});

		const result = Effect.runSync(
			forceDeleteEditorItemFx({
				config,
				itemId: "water",
			}),
		);

		expect(result.config.items).toEqual({});
		expect(result.impact.deletedOwnerItemIds).toEqual([
			"producer",
		]);
	});
});
