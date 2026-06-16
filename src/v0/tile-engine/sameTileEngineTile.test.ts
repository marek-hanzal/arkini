import { describe, expect, it } from "vitest";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { sameTileEngineTile } from "~/v0/tile-engine/sameTileEngineTile";

const createTile = (
	overrides: Partial<
		TileEngine.Tile<{
			value: string;
		}>
	> = {},
) =>
	({
		id: "tile-1",
		slotId: "slot-1",
		data: {
			value: "a",
		},
		...overrides,
	}) satisfies TileEngine.Tile<{
		value: string;
	}>;

describe("sameTileEngineTile", () => {
	it("treats equal render keys as equivalent even when data objects are recreated", () => {
		expect(
			sameTileEngineTile(
				createTile({
					renderKey: "same",
				}),
				createTile({
					renderKey: "same",
				}),
			),
		).toBe(true);
	});

	it("falls back to data identity when render keys are not provided", () => {
		const data = {
			value: "a",
		};

		expect(
			sameTileEngineTile(
				createTile({
					data,
				}),
				createTile({
					data,
				}),
			),
		).toBe(true);
		expect(sameTileEngineTile(createTile(), createTile())).toBe(false);
	});

	it("keeps actor geometry and visibility changes observable", () => {
		expect(
			sameTileEngineTile(
				createTile({
					renderKey: "same",
				}),
				createTile({
					renderKey: "same",
					slotId: "slot-2",
				}),
			),
		).toBe(false);
		expect(
			sameTileEngineTile(
				createTile({
					renderKey: "same",
				}),
				createTile({
					hidden: true,
					renderKey: "same",
				}),
			),
		).toBe(false);
	});
});
