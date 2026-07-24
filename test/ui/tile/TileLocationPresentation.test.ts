import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import { tileLocationForTargetFx } from "~/ui/tile/tileLocationForTargetFx";
import { tileSlotForLocationFx } from "~/ui/tile/tileSlotForLocationFx";
import { tileSurfaceForLocationFx } from "~/ui/tile/tileSurfaceForLocationFx";

describe("tile location presentation effects", () => {
	it.each([
		[
			{
				id: "board:3",
				kind: "board",
				space: 3,
			},
			{
				scope: "board",
				space: 3,
				position: {
					x: 4,
					y: 5,
				},
			},
		],
		[
			{
				id: "inventory",
				kind: "inventory",
			},
			{
				scope: "inventory",
				position: {
					x: 4,
					y: 5,
				},
			},
		],
		[
			{
				id: "toolbar",
				kind: "toolbar",
			},
			{
				scope: "toolbar",
				position: {
					x: 4,
					y: 5,
				},
			},
		],
	] as const)("round-trips one %s slot through its canonical location", (surface, location) => {
		const target = {
			kind: "slot",
			occupant: null,
			slot: {
				id: "source-slot",
				x: 4,
				y: 5,
			},
			surface,
		} as const satisfies TileDropTarget;

		const resolved = Effect.runSync(tileLocationForTargetFx(target));
		expect(resolved).toEqual(location);
		expect(Effect.runSync(tileSlotForLocationFx(location))).toEqual({
			id: "4:5",
			x: 4,
			y: 5,
		});
		expect(Effect.runSync(tileSurfaceForLocationFx(location))).toEqual(surface);
	});

	it.each([
		{
			kind: "outside",
		},
		{
			kind: "surface",
			surface: {
				id: "inventory",
				kind: "inventory",
			},
		},
	] as const)("does not invent a grid location for a non-slot target", (target) => {
		expect(Effect.runSync(tileLocationForTargetFx(target satisfies TileDropTarget))).toBeNull();
	});

	it("retains the public TileLocation output type", () => {
		const locationFx: Effect.Effect<TileLocation | null> = tileLocationForTargetFx({
			kind: "slot",
			occupant: null,
			slot: {
				id: "slot",
				x: 0,
				y: 0,
			},
			surface: {
				id: "toolbar",
				kind: "toolbar",
			},
		});
		expect(Effect.runSync(locationFx)?.scope).toBe("toolbar");
	});
});
