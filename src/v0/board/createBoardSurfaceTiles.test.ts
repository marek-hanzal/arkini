import { describe, expect, it } from "vitest";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import { createBoardSurfaceTiles } from "~/board/createBoardSurfaceTiles";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";

const boardView = (items: Parameters<typeof rebuildBoardView>[0]) => rebuildBoardView(items);

describe("createBoardSurfaceTiles", () => {
	it("hides live board items shadowed by transient boomerang tiles", () => {
		const tiles = createBoardSurfaceTiles({
			board: boardView([
				{
					id: "source",
					itemId: "item:twig",
					quantity: 2,
					state: {},
					x: 1,
					y: 0,
				},
				{
					id: "producer",
					itemId: "item:producer",
					state: {},
					x: 0,
					y: 0,
				},
			]),
			transientTiles: [
				{
					groupId: "group:input-store",
					hiddenBoardItemId: "source",
					id: "transient:source",
					itemId: "item:twig",
					quantity: 3,
					slotId: "1:0",
				},
			] satisfies BoardTransientTile[],
		});

		expect(tiles.find((tile) => tile.id === "source")?.hidden).toBe(true);
		expect(tiles.find((tile) => tile.id === "producer")?.hidden).toBe(false);
		expect(tiles.find((tile) => tile.id === "transient:source")?.hidden).toBeUndefined();
	});
});
