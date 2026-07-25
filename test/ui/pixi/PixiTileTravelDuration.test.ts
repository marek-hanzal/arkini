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

	it("increases duration with distance instead of increasing tile speed", () => {
		const oneTile = readDuration(1);
		const fourTiles = readDuration(4);
		const tenTiles = readDuration(10);

		expect(oneTile).toBeCloseTo(433.0127, 3);
		expect(fourTiles).toBeCloseTo(1000, 3);
		expect(tenTiles).toBeCloseTo(2500, 3);
		expect(oneTile).toBeLessThan(fourTiles);
		expect(fourTiles).toBeLessThan(tenTiles);
	});
});
