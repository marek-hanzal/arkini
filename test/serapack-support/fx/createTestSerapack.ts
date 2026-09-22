import { Effect } from "effect";

import { encodeTestSerapackPayloadFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { encodeTestSerapackEnvelopeFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import type { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import { createTestPngBytes } from "~test/serapack-support/fn/createTestPngBytes";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

export const testSerapackConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:test",
		title: "Test game",
		board: {
			width: 2,
			height: 2,
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
			maxQueueSize: 1,
			lines: [],

			uid: "water",
			id: "water",

			title: "Water",
			description: "Water",
			artwork: {
				scale: 0.8,
				default: [
					"asset-water",
				],
			},
		},
	},
});

export const createTestSerapack = (
	config = testSerapackConfig,
	packageId = config.meta.id,
	version: GameVersionSchema.Type = "1.0",
	serakki: SerakkiVersionSchema.Type = SerakkiAppVersion,
) => {
	const identifiedConfig = {
		...config,
		meta: {
			...config.meta,
			id: packageId,
		},
	};
	const encoded = Effect.runSync(
		encodeTestSerapackPayloadFx({
			version,
			serakki,
			config: identifiedConfig,
			resources: [
				{
					id: "hero",
					type: "image",
					bytes: createTestPngBytes(),
				},
				{
					id: "asset-water",
					type: "artwork",
					bytes: createTestPngBytes(),
				},
			],
		}),
	);
	return Effect.runSync(
		encodeTestSerapackEnvelopeFx({
			payload: encoded,
		}),
	);
};
