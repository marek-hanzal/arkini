import { describe, expect, it } from "vitest";
import { readTileEngineResponsiveSize } from "~/tile-engine/readTileEngineResponsiveSize";

describe("readTileEngineResponsiveSize", () => {
	it("fits a rectangular board into the available box using square cells", () => {
		const size = readTileEngineResponsiveSize({
			availableHeight: 1217,
			availableWidth: 773,
			columns: 7,
			gapPx: 1,
			rowCount: 11,
		});

		expect(size?.width).toBe(773);
		expect(size?.height).toBeCloseTo(1215.286, 3);
	});

	it("fits by height when width has spare room", () => {
		const size = readTileEngineResponsiveSize({
			availableHeight: 600,
			availableWidth: 1000,
			columns: 9,
			gapPx: 1,
			rowCount: 7,
		});

		expect(size?.height).toBe(600);
		expect(size?.width).toBeCloseTo(771.714, 3);
	});
});
