import { describe, expect, it } from "vitest";
import { createTileDropHandoffs } from "~/v0/tile-engine/createTileDropHandoffs";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

const createElement = () => ({}) as HTMLElement;

const sourceTile: TileEngine.Tile = {
	id: "tile:source",
	slotId: "slot:source",
	data: {},
};

const targetSlot: TileEngine.Slot = {
	id: "slot:target",
	data: {},
};

const targetTile: TileEngine.Tile = {
	id: "tile:target",
	slotId: "slot:target",
	data: {},
};

const createResolved = ({
	slot = targetSlot,
	tile = targetTile,
}: {
	slot?: TileEngine.Slot | null;
	tile?: TileEngine.Tile;
} = {}): TileEngineDrop.Resolved => ({
	dropId: "drop:target",
	slot,
	targetTile: tile,
	payload: {},
	element: createElement(),
});

describe("createTileDropHandoffs", () => {
	it("creates source and target handoffs for parallel target motion", () => {
		const handoffs = createTileDropHandoffs({
			sourceTile,
			resolved: createResolved(),
			includeTarget: true,
		});

		expect(handoffs).toEqual({
			source: {
				tileId: "tile:source",
				targetSlotId: "slot:target",
			},
			target: {
				tileId: "tile:target",
				targetSlotId: "slot:source",
			},
			all: [
				{
					tileId: "tile:source",
					targetSlotId: "slot:target",
				},
				{
					tileId: "tile:target",
					targetSlotId: "slot:source",
				},
			],
		});
	});

	it("omits target handoff when peer motion was not started", () => {
		const handoffs = createTileDropHandoffs({
			sourceTile,
			resolved: createResolved(),
			includeTarget: false,
		});

		expect(handoffs.all).toEqual([
			{
				tileId: "tile:source",
				targetSlotId: "slot:target",
			},
		]);
	});

	it("omits source handoff when there is no target slot", () => {
		const handoffs = createTileDropHandoffs({
			sourceTile,
			resolved: createResolved({
				slot: null,
			}),
			includeTarget: true,
		});

		expect(handoffs.source).toBeUndefined();
		expect(handoffs.all).toEqual([
			{
				tileId: "tile:target",
				targetSlotId: "slot:source",
			},
		]);
	});
});
