import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { GameRuntimeLayerFx } from "~/game-runtime/layer/GameRuntimeLayerFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:runtime-layer",
		title: "Runtime layer",
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
	},
	items: {},
});

describe("GameRuntimeLayerFx", () => {
	it("provides a fresh empty runtime from game config", () => {
		const runtime = Effect.runSync(
			readRuntimeFx().pipe(
				Effect.provide(
					GameRuntimeLayerFx({
						config,
					}),
				),
			),
		);

		expect(runtime.items).toEqual([]);
	});
});
