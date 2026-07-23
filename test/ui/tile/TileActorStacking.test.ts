import { describe, expect, it } from "vitest";

import type { TileLocation } from "~/bridge/tile/TileLocation";
import {
	readTileActorStackingZIndex,
	tileInventoryOverlayZIndex,
} from "~/ui/tile/TileActorStacking";

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
	phase: Parameters<typeof readTileActorStackingZIndex>[0]["phase"],
	localZIndex: number,
) =>
	readTileActorStackingZIndex({
		location,
		phase,
		localZIndex,
	});

describe("TileActor stacking", () => {
	it("occludes passive Board and Toolbar actors while keeping Inventory actors above its panel", () => {
		expect(zIndex(board, "stable", 10)).toBeLessThan(tileInventoryOverlayZIndex);
		expect(zIndex(board, "hovered", 20)).toBeLessThan(tileInventoryOverlayZIndex);
		expect(zIndex(toolbar, "targeted", 25)).toBeLessThan(tileInventoryOverlayZIndex);
		expect(zIndex(inventory, "stable", 10)).toBeGreaterThan(tileInventoryOverlayZIndex);
		expect(zIndex(inventory, "hovered", 20)).toBeGreaterThan(tileInventoryOverlayZIndex);
	});

	it("lifts cross-surface travel above the Inventory panel regardless of its source scope", () => {
		for (const location of [
			board,
			inventory,
			toolbar,
		]) {
			for (const phase of [
				"dragging",
				"combining",
				"settling",
				"impact",
				"exiting",
			] as const) {
				expect(zIndex(location, phase, 0)).toBeGreaterThan(tileInventoryOverlayZIndex);
			}
		}
	});
});
