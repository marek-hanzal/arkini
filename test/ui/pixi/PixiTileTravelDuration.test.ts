import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";

const readDuration = (distanceInTiles: number) =>
	Effect.runSync(
		readPixiTileTravelDurationMsFx({
			fromX: 0,
			fromY: 0,
			tileSize: 100,
			toX: distanceInTiles * 100,
			toY: 0,
		}),
	);

describe("Pixi tile travel duration", () => {
	it("keeps zero-distance reconciliation immediate", () => {
		expect(readDuration(0)).toBe(0);
	});

	it("keeps short travel readable while letting long travel cover tiles faster", () => {
		const quarterTile = readDuration(0.25);
		const oneTile = readDuration(1);
		const fourTiles = readDuration(4);
		const tenTiles = readDuration(10);

		expect(quarterTile).toBe(280);
		expect(oneTile).toBe(280);
		expect(fourTiles).toBeCloseTo(547.7226, 3);
		expect(tenTiles).toBeCloseTo(1250, 3);
		expect(oneTile).toBeLessThan(fourTiles);
		expect(fourTiles).toBeLessThan(tenTiles);
		expect(1 / (oneTile / 1000)).toBeLessThan(4 / (fourTiles / 1000));
		expect(4 / (fourTiles / 1000)).toBeLessThan(10 / (tenTiles / 1000));
	});
});
