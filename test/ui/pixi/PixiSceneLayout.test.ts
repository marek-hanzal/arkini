import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiInventorySceneLayoutFx } from "~/ui/pixi/layout/readPixiInventorySceneLayoutFx";
import { readPixiMainSceneLayoutFx } from "~/ui/pixi/layout/readPixiMainSceneLayoutFx";

describe("Pixi scene layout", () => {
	it("fits Board and Toolbar into one padded native scene", () => {
		const layout = Effect.runSync(
			readPixiMainSceneLayoutFx({
				boardHeight: 7,
				boardWidth: 11,
				height: 900,
				toolbarSize: 8,
				width: 1100,
			}),
		);

		expect(layout.viewportPadding).toBe(36);
		expect(layout.board.cellSize).toBeCloseTo(1028 / 11);
		expect(layout.board).toMatchObject({
			width: 1028,
			x: 36,
		});
		expect(layout.toolbarGap).toBeCloseTo(layout.board.cellSize / 4);
		expect(layout.toolbar).toMatchObject({
			cellSize: 128.5,
			height: 128.5,
			width: 1028,
			x: 36,
		});
		expect(layout.toolbar?.y).toBeCloseTo(
			layout.board.y + layout.board.height + layout.toolbarGap,
		);
	});

	it("gives a wider Toolbar smaller cells while preserving padding and the gap", () => {
		const layout = Effect.runSync(
			readPixiMainSceneLayoutFx({
				boardHeight: 2,
				boardWidth: 3,
				height: 600,
				toolbarSize: 6,
				width: 600,
			}),
		);

		expect(layout.viewportPadding).toBe(24);
		expect(layout.board.cellSize).toBe(184);
		expect(layout.board.x).toBe(24);
		expect(layout.board.width).toBe(552);
		expect(layout.toolbarGap).toBe(46);
		expect(layout.toolbar?.cellSize).toBe(92);
		expect(layout.toolbar?.width).toBe(552);
	});

	it("centers the isolated Inventory grid inside its modal canvas", () => {
		const layout = Effect.runSync(
			readPixiInventorySceneLayoutFx({
				actorSize: 96,
				columns: 5,
				height: 480,
				rows: 4,
				width: 800,
			}),
		);

		expect(layout.actorSize).toBe(96);
		expect(layout.surface.cellSize).toBe(120);
		expect(layout.surface).toMatchObject({
			height: 480,
			width: 600,
			x: 100,
			y: 0,
		});
	});

	it("keeps the Board actor size independent from Inventory slot density", () => {
		const main = Effect.runSync(
			readPixiMainSceneLayoutFx({
				boardHeight: 7,
				boardWidth: 11,
				height: 900,
				toolbarSize: 8,
				width: 1100,
			}),
		);
		const inventory = Effect.runSync(
			readPixiInventorySceneLayoutFx({
				actorSize: main.board.cellSize,
				columns: 5,
				height: 480,
				rows: 4,
				width: 800,
			}),
		);

		expect(inventory.surface.cellSize).toBe(120);
		expect(inventory.actorSize).toBe(main.board.cellSize);
		expect(inventory.actorSize).not.toBe(inventory.surface.cellSize);
	});

	it("lets a dense Inventory overflow instead of shrinking Board-sized actors", () => {
		const layout = Effect.runSync(
			readPixiInventorySceneLayoutFx({
				actorSize: 96,
				columns: 9,
				height: 240,
				rows: 6,
				width: 360,
			}),
		);

		expect(layout.actorSize).toBe(96);
		expect(layout.surface.cellSize).toBe(96);
		expect(layout.surface.width).toBe(864);
		expect(layout.surface.height).toBe(576);
	});
});
