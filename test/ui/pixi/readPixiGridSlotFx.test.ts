import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiGridSlotFx } from "~/ui/pixi/grid/readPixiGridSlotFx";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

const surface = {
	cellSize: 30,
	columns: 2,
	height: 60,
	kind: "board",
	rows: 2,
	width: 60,
	x: 10,
	y: 20,
} satisfies PixiGridSurfaceLayout;

const readSlot = (x: number, y: number) =>
	Effect.runSync(
		readPixiGridSlotFx({
			surface,
			x,
			y,
		}),
	);

describe("readPixiGridSlotFx", () => {
	it("maps pointer coordinates only into an owned grid slot", () => {
		expect(readSlot(25, 35)).toEqual({
			x: 0,
			y: 0,
		});
		expect(readSlot(70, 80)).toEqual({
			x: 1,
			y: 1,
		});
		expect(readSlot(9, 35)).toBeNull();
		expect(
			Effect.runSync(
				readPixiGridSlotFx({
					surface: null,
					x: 25,
					y: 35,
				}),
			),
		).toBeNull();
	});
});
