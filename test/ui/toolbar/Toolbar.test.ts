import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
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

const createConfig = (toolbarSize?: number) =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: `game:toolbar-ui:${toolbarSize ?? "disabled"}`,
			title: "Toolbar UI",
			board: {
				width: 3,
				height: 3,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			toolbarSize,
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

const createGame = (toolbarSize?: number, stored = false): GameEngine => {
	const config = createConfig(toolbarSize);
	const initialRuntime = Effect.runSync(
		startFx().pipe(
			useGameFx({
				config,
			}),
		),
	);
	const runtime = stored
		? RuntimeSchema.parse({
				...initialRuntime,
				items: initialRuntime.items.map((item) => ({
					...item,
					location: {
						scope: "toolbar",
						position: {
							x: 1,
							y: 0,
						},
					},
				})),
			})
		: initialRuntime;
	let claimedTilePresentationSequence = -1;
	return {
		arkpack: {
			packageId: "test-package",
			contentHash: "test-hash",
			gameId: config.meta.id,
			title: config.meta.title,
			configVersion: config.version,
			compressedSize: 0,
			trust: {
				type: "external",
				reason: "unsigned",
			} as const,
			source: "imported" as const,
		},
		config,
		saveKey: {
			packageId: "test-package",
			contentHash: "0".repeat(64),
		},
		getSnapshot: () => runtime,
		getTransitionSnapshot: () => ({
			sequence: 0,
			previousRuntime: null,
			runtime,
			events: [],
		}),
		canClaimTilePresentationTransition: (sequence: number) =>
			sequence > claimedTilePresentationSequence,
		claimTilePresentationTransition: (sequence: number) => {
			if (sequence <= claimedTilePresentationSequence) return false;
			claimedTilePresentationSequence = sequence;
			return true;
		},
		getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
		subscribe: () => () => undefined,
		subscribeTransitions: (listener) => {
			void listener({
				sequence: 0,
				previousRuntime: null,
				runtime,
				events: [],
			});
			return () => undefined;
		},
		subscribeEvents: () => () => undefined,
		read: testGameRead,
		readOrThrow: testGameReadOrThrow,
		run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
		disposeFx: Effect.void,
		disposeWithoutSaveFx: Effect.void,
		flushSaveFx: Effect.void,
	};
};

const renderGameBoard = (game: GameEngine) => {
	gameEngineState.game = game;
	return renderToStaticMarkup(
		createElement(
			ItemDetailProvider,
			null,
			createElement(TileSystemProvider, null, createElement(GameBoardLayout)),
		),
	);
};

describe("Toolbar", () => {
	it("renders no toolbar shell or layout row when disabled", () => {
		const html = renderGameBoard(createGame(0));

		expect(html).toContain('data-ui="GameBoardLayout"');
		expect(html).toContain('data-toolbar-enabled="false"');
		expect(html).toContain("grid-template-rows:minmax(0, 1fr)");
		expect(html).not.toContain('data-ui="Toolbar"');
		expect(html).not.toContain('data-ui="ToolbarFrame"');
		expect(html).not.toContain('data-ui="ToolbarCell"');
	});

	it("renders one shared styled row with the configured slot count and live actor", () => {
		const html = renderGameBoard(createGame(3, true));
		const toolbarCells = [
			...html.matchAll(/data-ui="ToolbarCell"/g),
		];

		expect(toolbarCells).toHaveLength(3);
		expect(html).toContain('data-toolbar-enabled="true"');
		expect(html).toContain('data-ui="BoardFrame" data-tile-grid-frame="true"');
		expect(html).toContain('data-ui="ToolbarFrame" data-tile-grid-frame="true"');
		expect(html).toContain('data-tile-grid-surface="toolbar"');
		expect(html).toContain('data-ui="ToolbarGrid" data-tile-grid="true"');
		expect(html).toContain('data-tile-surface="toolbar"');
		const toolbarTones = [
			...html.matchAll(/data-ui="ToolbarCell"[^>]*data-tile-slot-tone="([ab])"/g),
		].map((match) => match[1]);
		expect(toolbarTones).toEqual([
			"b",
			"a",
			"b",
		]);
		expect(html).toContain('data-toolbar-x="1"');
		expect(html).toContain('data-location-scope="toolbar"');
		expect(html).toContain('data-item-id="water"');
	});

	it("renders the full supported sixty-four-slot row without wrapping the grid", () => {
		const html = renderGameBoard(createGame(64));

		expect([
			...html.matchAll(/data-ui="ToolbarCell"/g),
		]).toHaveLength(64);
		expect(html).toContain(
			"grid-template-columns:repeat(64, minmax(0, 1fr));grid-template-rows:repeat(1, minmax(0, 1fr))",
		);
		expect(html).toContain("width:calc(100% * 64 / var(--game-board-columns))");
	});
});
