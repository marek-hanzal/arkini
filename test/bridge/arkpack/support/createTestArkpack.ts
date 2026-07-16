import { gzipSync } from "node:zlib";
import { Effect } from "effect";

import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export const testArkpackConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:bridge",
		title: "Bridge game",
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
				x: 1,
				y: 0,
			},
		],
	},
	categories: {
		resource: {
			id: "resource",
			title: "Resources",
		},
	},
	items: {
		water: {
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				source: [
					"asset:water",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
	},
});

export const createTestArkpack = (config = testArkpackConfig) => {
	const encoded = Effect.runSync(
		encodeFx({
			config,
			resources: [
				{
					id: "hero",
					mime: "image/png",
					bytes: new Uint8Array([
						1,
					]),
				},
				{
					id: "asset:water",
					mime: "image/png",
					bytes: new Uint8Array([
						2,
					]),
				},
			],
		}),
	);
	return new Uint8Array(gzipSync(encoded));
};
