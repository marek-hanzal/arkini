import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TileGridFrame } from "~/ui/tile/TileGridFrame";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

vi.mock("~/bridge/tile/useTileActors", () => ({
	useTileActors: () => [],
}));

const surfaces = [
	{
		id: "board:0",
		kind: "board",
		space: 0,
	},
	{
		id: "toolbar",
		kind: "toolbar",
	},
	{
		id: "inventory",
		kind: "inventory",
	},
] satisfies ReadonlyArray<TileSurface>;

const cells = [
	{
		index: 0,
		x: 0,
		y: 0,
		occupant: null,
	},
	{
		index: 1,
		x: 1,
		y: 0,
		occupant: null,
	},
	{
		index: 2,
		x: 0,
		y: 1,
		occupant: null,
	},
	{
		index: 3,
		x: 1,
		y: 1,
		occupant: null,
	},
] as const;

describe("TileGridFrame", () => {
	it("uses one coordinate-derived alternating slot contract for every grid surface", () => {
		const html = renderToStaticMarkup(
			createElement(
				TileSystemProvider,
				null,
				...surfaces.map((surface) =>
					createElement(TileGridFrame, {
						key: surface.id,
						surface,
						width: 2,
						height: 2,
						cells,
						frameUi: `${surface.kind}-frame`,
						gridUi: `${surface.kind}-grid`,
						cellUi: `${surface.kind}-cell`,
					}),
				),
			),
		);

		for (const surface of surfaces) {
			expect(html).toContain(`data-tile-surface="${surface.kind}"`);
		}
		expect([
			...html.matchAll(/data-tile-slot-tone="a"/g),
		]).toHaveLength(6);
		expect([
			...html.matchAll(/data-tile-slot-tone="b"/g),
		]).toHaveLength(6);
	});
});
