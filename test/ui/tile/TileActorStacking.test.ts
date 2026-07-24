import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileLocation } from "~/bridge/tile/TileLocation";
import {
	readTileActorStackingZIndexFx,
	tileInventoryOverlayZIndex,
} from "~/ui/tile/readTileActorStackingZIndexFx";

const board = {
	scope: "board",
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
} as const satisfies TileLocation;

const inventory = {
	scope: "inventory",
	position: {
		x: 0,
		y: 0,
	},
} as const satisfies TileLocation;

const toolbar = {
	scope: "toolbar",
	position: {
		x: 0,
		y: 0,
	},
} as const satisfies TileLocation;

const zIndex = (
	location: TileLocation,
	phase: Parameters<typeof readTileActorStackingZIndexFx>[0]["phase"],
	localZIndex: number,
) =>
	Effect.runSync(
		readTileActorStackingZIndexFx({
			location,
			phase,
			localZIndex,
		}),
	);

describe("TileActor stacking", () => {
	it("occludes passive Board and Toolbar actors while keeping Inventory actors above its panel", () => {
		expect(zIndex(board, "stable", 10)).toBeLessThan(tileInventoryOverlayZIndex);
		expect(zIndex(toolbar, "targeted", 25)).toBeLessThan(tileInventoryOverlayZIndex);
		expect(zIndex(inventory, "stable", 10)).toBeGreaterThan(tileInventoryOverlayZIndex);
	});

	it("lifts direct dragging above the Inventory panel regardless of its source scope", () => {
		for (const location of [
			board,
			inventory,
			toolbar,
		]) {
			expect(zIndex(location, "dragging", 0)).toBeGreaterThan(tileInventoryOverlayZIndex);
		}
	});
});
