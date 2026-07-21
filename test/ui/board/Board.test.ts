import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { startFx } from "~/engine/start/write/startFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { Board } from "~/ui/board/Board";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { testGameRead, testGameReadOrThrow } from "~test/support/game/testGameRead";

const gameEngineState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

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

const unavailableRun: GameEngine["run"] = () => Promise.reject(new Error("Not used by this test."));

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
	getSnapshot: () => runtime,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	readOrThrow: testGameReadOrThrow,
	run: unavailableRun,
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

const readAttribute = (tag: string, name: string) => {
	const value = tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
	if (value === undefined) throw new Error(`Missing ${name} on rendered board cell.`);
	return value;
};

const readBoardCells = (html: string) =>
	[
		...html.matchAll(/<div[^>]*data-ui="BoardCell"[^>]*>/g),
	].map((match) => {
		const tag = match[0];
		const style = readAttribute(tag, "style");
		const column = style.match(/grid-column-start:(\d+)/)?.[1];
		const row = style.match(/grid-row-start:(\d+)/)?.[1];
		if (column === undefined || row === undefined) {
			throw new Error("Rendered board cell is missing explicit grid coordinates.");
		}
		return {
			column: Number(column),
			row: Number(row),
			x: Number(readAttribute(tag, "data-board-x")),
			y: Number(readAttribute(tag, "data-board-y")),
		};
	});

describe("Board", () => {
	it("renders the current canonical board through the headless tile system", () => {
		gameEngineState.game = game;
		const html = renderToStaticMarkup(
			createElement(
				ItemDetailProvider,
				null,
				createElement(TileSystemProvider, null, createElement(Board)),
			),
		);
		const cells = readBoardCells(html);

		expect(cells).toHaveLength(6);
		expect(html).toContain('data-ui="BoardFrame" data-tile-grid-frame="true"');
		expect(html).toContain('data-ui="BoardGrid" data-tile-grid="true"');
		expect(cells).toEqual([
			{
				column: 1,
				row: 1,
				x: 0,
				y: 0,
			},
			{
				column: 2,
				row: 1,
				x: 1,
				y: 0,
			},
			{
				column: 3,
				row: 1,
				x: 2,
				y: 0,
			},
			{
				column: 1,
				row: 2,
				x: 0,
				y: 1,
			},
			{
				column: 2,
				row: 2,
				x: 1,
				y: 1,
			},
			{
				column: 3,
				row: 2,
				x: 2,
				y: 1,
			},
		]);
		expect(html).toContain('data-ui="Board"');
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
		} satisfies GameEngine;
		gameEngineState.game = desktopGame;
		const html = renderToStaticMarkup(
			createElement(
				ItemDetailProvider,
				null,
				createElement(TileSystemProvider, null, createElement(Board)),
			),
		);
		const cells = readBoardCells(html);
		const lastCell = cells.find((cell) => cell.x === 12 && cell.y === 8);

		expect(cells).toHaveLength(117);
		expect(lastCell).toEqual({
			column: 13,
			row: 9,
			x: 12,
			y: 8,
		});
		expect(html).toContain("grid-column-start:13");
		expect(html).toContain("grid-row-start:9");
	});
});
