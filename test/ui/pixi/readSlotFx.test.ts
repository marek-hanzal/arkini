import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readSlotFx } from "~/ui/pixi/grid/readSlotFx";
import type { SurfaceLayout } from "~/ui/pixi/layout/SceneLayout";

const surface = {
	cellSize: 30,
	columns: 2,
	height: 60,
	kind: "board",
	rows: 2,
	width: 60,
	x: 10,
	y: 20,
} satisfies SurfaceLayout;

const readSlot = (x: number, y: number) =>
	Effect.runSync(
		readSlotFx({
			surface,
			x,
			y,
		}),
	);

describe("readSlotFx", () => {
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
				readSlotFx({
					surface: null,
					x: 25,
					y: 35,
				}),
			),
		).toBeNull();
	});
});
