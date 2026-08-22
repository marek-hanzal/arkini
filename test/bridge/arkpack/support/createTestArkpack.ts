import { gzipSync } from "node:zlib";
import { Effect } from "effect";

import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createTestPngBytes } from "~test/bridge/arkpack/support/createTestPngBytes";

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
	items: {
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				default: [
					"asset:water",
				],
			},
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
					bytes: createTestPngBytes(),
				},
				{
					id: "asset:water",
					mime: "image/png",
					bytes: createTestPngBytes(),
				},
			],
		}),
	);
	return new Uint8Array(gzipSync(encoded));
};
