import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Inventory } from "~/ui/inventory/Inventory";
import { InventoryProvider } from "~/ui/inventory/InventoryProvider";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead, testGameReadOrThrow } from "~test/support/game/testGameRead";

const gameEngineState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const game = gameEngineState.game;
		if (game === undefined) throw new Error("Test Game Engine is missing.");
		return game;
	},
}));
vi.mock("~/ui/pixi/PixiInventorySurface", async () => {
	const { createElement: createReactElement } = await import("react");
	return {
		PixiInventorySurface: () =>
			createReactElement("div", {
				"data-ui": "PixiInventorySurface",
			}),
	};
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:inventory-ui",
		title: "Inventory UI",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 3,
			height: 2,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "copper",
				space: 0,
				x: 1,
				y: 1,
			},
		],
		inventory: [
			{
				itemId: "water",
			},
			{
				itemId: "stone",
			},
		],
	},
	categories: {},
	items: {
		copper: {
			id: "copper",
			type: "simple",
			title: "Copper",
			description: "Copper",
			asset: {
				source: [
					"asset:copper",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
		stone: {
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "Stone",
			asset: {
				source: [
					"asset:stone",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
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

const game = {
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
	...Effect.runSync(makeTestGameTransitionFieldsFx(runtime)),
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	readOrThrow: testGameReadOrThrow,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

describe("Inventory", () => {
	it("renders the configured Inventory through an isolated Pixi surface", () => {
		gameEngineState.game = game;
		const html = renderToStaticMarkup(
			createElement(InventoryProvider, null, createElement(Inventory)),
		);

		expect(html).toContain('data-ui="Inventory"');
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		expect(html).toContain('data-ui="InventoryViewport"');
		expect(html).toContain('data-ui="InventoryGridAspect"');
		expect(html).toContain("aspect-ratio:3 / 2");
		expect([
			...html.matchAll(/data-ui="PixiInventorySurface"/g),
		]).toHaveLength(1);
	});
});
