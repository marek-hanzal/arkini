import { gzipSync } from "node:zlib";
import { Effect } from "effect";

import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { encodeArkpackEnvelopeFx } from "~/engine/pack/fx/encodeArkpackEnvelopeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import type { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { createTestPngBytes } from "~test/bridge/arkpack/support/createTestPngBytes";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

export const testArkpackConfig = GameConfigSchema.parse({
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

export const createTestArkpack = (
	config = testArkpackConfig,
	packageId = config.meta.id,
	version: ArkpackVersionSchema.Type = "1.0",
	arkini: ArkiniVersionSchema.Type = ArkiniAppVersion,
) => {
	const identifiedConfig = {
		...config,
		meta: {
			...config.meta,
			id: packageId,
		},
	};
	const encoded = Effect.runSync(
		encodeFx({
			version,
			arkini,
			config: identifiedConfig,
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
	return Effect.runSync(
		encodeArkpackEnvelopeFx({
			payload: new Uint8Array(gzipSync(encoded)),
		}),
	);
};
