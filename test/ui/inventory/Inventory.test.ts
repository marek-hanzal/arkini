import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Inventory } from "~/ui/inventory/Inventory";
import { InventoryProvider } from "~/ui/inventory/InventoryProvider";
import { useInventoryView } from "~/ui/inventory/useInventoryView";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

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
vi.mock("~/bridge/tile/useDropItemPreview", () => ({
	useDropItemPreview: () => () => {
		throw new Error("Inventory rendering must not read a gameplay drop preview.");
	},
}));
vi.mock("~/bridge/tile/useDropItemPreviewSequence", () => ({
	useDropItemPreviewSequence: () => () => 0,
}));
vi.mock("~/ui/tile/TileActorLayer", async () => {
	const { createElement: createReactElement } = await import("react");
	return {
		TileActorLayer: () =>
			createReactElement("div", {
				"data-ui": "TileActorLayer",
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
	config,
	getSnapshot: () => runtime,
	subscribe: () => () => undefined,
} as unknown as GameEngine;

describe("Inventory", () => {
	it("projects only canonical Inventory occupants into exact row-major configured cells", () => {
		gameEngineState.game = game;
		let view: ReturnType<typeof useInventoryView> | undefined;
		const Probe = () => {
			view = useInventoryView();
			return null;
		};

		renderToStaticMarkup(createElement(Probe));

		const current = view;
		if (current === undefined) throw new Error("Missing Inventory view.");
		const inventoryItems = runtime.items.filter(
			(item) => item.location.scope === LocationScopeEnumSchema.enum.Inventory,
		);
		expect(current.width).toBe(3);
		expect(current.height).toBe(2);
		expect(current.surface).toEqual({
			id: "inventory",
			kind: "inventory",
		});
		expect(current.cells).toHaveLength(6);
		expect(
			current.cells.map(({ index, x, y, occupant }) => ({
				index,
				x,
				y,
				occupant,
			})),
		).toEqual([
			{
				index: 0,
				x: 0,
				y: 0,
				occupant: {
					id: inventoryItems[0]?.id,
					revision: inventoryItems[0]?.revision,
				},
			},
			{
				index: 1,
				x: 1,
				y: 0,
				occupant: {
					id: inventoryItems[1]?.id,
					revision: inventoryItems[1]?.revision,
				},
			},
			{
				index: 2,
				x: 2,
				y: 0,
				occupant: null,
			},
			{
				index: 3,
				x: 0,
				y: 1,
				occupant: null,
			},
			{
				index: 4,
				x: 1,
				y: 1,
				occupant: null,
			},
			{
				index: 5,
				x: 2,
				y: 1,
				occupant: null,
			},
		]);
		expect(
			current.cells.some((cell) =>
				runtime.items.some(
					(item) =>
						item.location.scope === LocationScopeEnumSchema.enum.Board &&
						cell.occupant?.id === item.id,
				),
			),
		).toBe(false);
	});

	it("renders the configured Inventory through one shared tile grid and actor layer", () => {
		gameEngineState.game = game;
		const html = renderToStaticMarkup(
			createElement(
				InventoryProvider,
				null,
				createElement(TileSystemProvider, null, createElement(Inventory)),
			),
		);

		expect(html).toContain('data-ui="Inventory"');
		expect(html).toContain('data-ui="InventoryFrame" data-tile-grid-frame="true"');
		expect(html).toContain('data-ui="InventoryGrid" data-tile-grid="true"');
		expect(html).toContain('data-tile-surface="inventory"');
		expect(html).toContain("aspect-ratio:3 / 2");
		expect([
			...html.matchAll(/data-ui="InventoryCell"/g),
		]).toHaveLength(6);
		expect([
			...html.matchAll(/data-ui="TileActorLayer"/g),
		]).toHaveLength(1);
	});
});
