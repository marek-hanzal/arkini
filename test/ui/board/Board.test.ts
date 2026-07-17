import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { GameProvider } from "~/bridge/game/GameProvider";
import { startFx } from "~/engine/start/write/startFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { Board } from "~/ui/board/Board";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:board-ui",
		title: "Board UI",
		board: {
			width: 3,
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
				x: 2,
				y: 1,
			},
		],
	},
	categories: {},
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

const runtime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);

const unavailableRun: Game["run"] = () => Promise.reject(new Error("Not used by this test."));

const game = {
	arkpack: {
		packageId: "test-package",
		contentHash: "test-hash",
		gameId: config.meta.id,
		title: config.meta.title,
		configVersion: config.version,
		compressedSize: 0,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "test-package",
		contentHash: "0".repeat(64),
	},
	instanceKey: "test-game",
	getSnapshot: () => runtime,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
	run: unavailableRun,
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies Game;

describe("Board", () => {
	it("renders the current canonical board through the headless tile system", () => {
		const html = renderToStaticMarkup(
			createElement(GameProvider, {
				game,
				children: createElement(TileSystemProvider, null, createElement(Board)),
			}),
		);

		expect(html).toContain("board space 0");
		expect(html).toContain('data-ui="BoardViewport"');
		expect(html).toContain('data-ui="BoardGrid"');
		expect(html).toContain("--board-width-from-height:150cqh");
		expect(html).not.toContain("36rem");
		expect(html).toContain('data-item-id="water"');
		expect(html).toContain("data-runtime-revision=");
		expect(html).toContain('src="resource:asset:water"');
		expect(html).toContain("grid-column-start:3");
		expect(html).toContain("grid-row-start:2");
	});
});
