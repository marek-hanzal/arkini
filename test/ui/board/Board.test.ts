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

		expect(html.match(/aria-hidden="true"/g)).toHaveLength(6);
		expect(html).toContain('data-item-id="water"');
		expect(html).toContain('src="resource:asset:water"');
		expect(html).toContain("grid-column-start:3");
		expect(html).toContain("grid-row-start:2");
	});
	it("renders all 117 cells and the new maximum coordinate for a 13 by 9 board", () => {
		const desktopConfig = GameConfigSchema.parse({
			...config,
			meta: {
				...config.meta,
				board: {
					width: 13,
					height: 9,
				},
			},
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "water",
						space: 0,
						x: 12,
						y: 8,
					},
				],
			},
		});
		const desktopRuntime = Effect.runSync(
			startFx().pipe(
				useGameFx({
					config: desktopConfig,
				}),
			),
		);
		const desktopGame = {
			...game,
			config: desktopConfig,
			getSnapshot: () => desktopRuntime,
		} satisfies Game;
		const html = renderToStaticMarkup(
			createElement(GameProvider, {
				game: desktopGame,
				children: createElement(TileSystemProvider, null, createElement(Board)),
			}),
		);

		expect(html.match(/aria-hidden="true"/g)).toHaveLength(117);
		expect(html).toContain("grid-column-start:13");
		expect(html).toContain("grid-row-start:9");
	});
});
