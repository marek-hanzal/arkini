import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";

export const editorTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "editor-test",
		title: "Editor test",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "water",
				space: 0,
				x: 0,
				y: 0,
			},
		],
	},
	items: {
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				default: [
					"item-water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
	},
});

export const editorTestPayload: PayloadSchema.Type = {
	version: "1.0",
	arkini: "0.5.0",
	config: editorTestConfig,
	resources: [
		{
			id: "hero",
			mime: "image/png",
			bytes: new Uint8Array([
				1,
				2,
			]),
		},
		{
			id: "item-water",
			mime: "image/png",
			bytes: new Uint8Array([
				3,
				4,
			]),
		},
	],
};
