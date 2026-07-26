import { Effect } from "effect";
import type { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";

import { drawPixiGridDropFeedbackFx } from "~/ui/pixi/grid/drawPixiGridDropFeedbackFx";
import { drawPixiGridMaskFx } from "~/ui/pixi/grid/drawPixiGridMaskFx";
import { drawPixiGridSurfaceFx } from "~/ui/pixi/grid/drawPixiGridSurfaceFx";
import { readPixiGridSlotFx } from "~/ui/pixi/grid/readPixiGridSlotFx";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

class FakeGraphics {
	readonly calls: Array<{
		readonly args: readonly unknown[];
		readonly name: string;
	}> = [];
	visible = true;

	clear() {
		this.calls.push({
			args: [],
			name: "clear",
		});
		return this;
	}

	closePath() {
		this.calls.push({
			args: [],
			name: "closePath",
		});
		return this;
	}

	fill(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "fill",
		});
		return this;
	}

	lineTo(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "lineTo",
		});
		return this;
	}

	moveTo(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "moveTo",
		});
		return this;
	}

	quadraticCurveTo(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "quadraticCurveTo",
		});
		return this;
	}

	rect(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "rect",
		});
		return this;
	}

	roundRect(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "roundRect",
		});
		return this;
	}

	stroke(...args: readonly unknown[]) {
		this.calls.push({
			args,
			name: "stroke",
		});
		return this;
	}
}

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

const asGraphics = (graphics: FakeGraphics) => graphics as unknown as Graphics;

describe("Pixi grid surface primitives", () => {
	it("resolves slots at interior and inclusive outer-edge coordinates", () => {
		expect(
			Effect.runSync(
				readPixiGridSlotFx({
					surface,
					x: 25,
					y: 35,
				}),
			),
		).toEqual({
			x: 0,
			y: 0,
		});
		expect(
			Effect.runSync(
				readPixiGridSlotFx({
					surface,
					x: 70,
					y: 80,
				}),
			),
		).toEqual({
			x: 1,
			y: 1,
		});
		expect(
			Effect.runSync(
				readPixiGridSlotFx({
					surface,
					x: 9,
					y: 35,
				}),
			),
		).toBeNull();
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

	it("paints the checkerboard and hides a missing surface", () => {
		const graphics = new FakeGraphics();

		Effect.runSync(
			drawPixiGridSurfaceFx({
				graphics: asGraphics(graphics),
				lineColor: 0x030303,
				slotColors: [
					0x010101,
					0x020202,
				],
				surface,
				surfaceColor: 0x040404,
			}),
		);

		expect(graphics.visible).toBe(true);
		expect(
			graphics.calls.filter(({ name }) => name === "rect").map(({ args }) => args),
		).toEqual([
			[
				10,
				20,
				30,
				30,
			],
			[
				40,
				20,
				30,
				30,
			],
			[
				10,
				50,
				30,
				30,
			],
			[
				40,
				50,
				30,
				30,
			],
		]);
		expect(
			graphics.calls
				.filter(({ name }) => name === "fill")
				.slice(1)
				.map(({ args }) => args[0]),
		).toEqual([
			{
				alpha: 0.92,
				color: 0x010101,
			},
			{
				alpha: 0.92,
				color: 0x020202,
			},
			{
				alpha: 0.92,
				color: 0x020202,
			},
			{
				alpha: 0.92,
				color: 0x010101,
			},
		]);

		Effect.runSync(
			drawPixiGridSurfaceFx({
				graphics: asGraphics(graphics),
				lineColor: 0x030303,
				slotColors: [
					0x010101,
					0x020202,
				],
				surface: null,
				surfaceColor: 0x040404,
			}),
		);
		expect(graphics.visible).toBe(false);
		expect(graphics.calls.at(-1)).toEqual({
			args: [],
			name: "clear",
		});
	});

	it("paints a matching rounded mask and clears it when absent", () => {
		const graphics = new FakeGraphics();

		Effect.runSync(
			drawPixiGridMaskFx({
				graphics: asGraphics(graphics),
				surface,
			}),
		);

		expect(graphics.calls).toEqual([
			{
				args: [],
				name: "clear",
			},
			{
				args: [
					10,
					20,
					60,
					60,
					3.5999999999999996,
				],
				name: "roundRect",
			},
			{
				args: [
					0xffffff,
				],
				name: "fill",
			},
		]);

		Effect.runSync(
			drawPixiGridMaskFx({
				graphics: asGraphics(graphics),
				surface: null,
			}),
		);
		expect(graphics.calls.at(-1)).toEqual({
			args: [],
			name: "clear",
		});
	});

	it("paints an interior slot feedback marker and clears an empty target", () => {
		const graphics = new FakeGraphics();
		const interiorSurface = {
			...surface,
			columns: 3,
			height: 90,
			rows: 3,
			width: 90,
		} satisfies PixiGridSurfaceLayout;

		Effect.runSync(
			drawPixiGridDropFeedbackFx({
				color: 0xabcdef,
				graphics: asGraphics(graphics),
				slot: {
					x: 1,
					y: 1,
				},
				surface: interiorSurface,
			}),
		);

		expect(graphics.calls).toEqual([
			{
				args: [],
				name: "clear",
			},
			{
				args: [
					40,
					50,
					30,
					30,
				],
				name: "rect",
			},
			{
				args: [
					{
						alpha: 0.16,
						color: 0xabcdef,
					},
				],
				name: "fill",
			},
			{
				args: [
					{
						alpha: 0.95,
						color: 0xabcdef,
						width: 2,
					},
				],
				name: "stroke",
			},
		]);

		Effect.runSync(
			drawPixiGridDropFeedbackFx({
				color: 0xabcdef,
				graphics: asGraphics(graphics),
				slot: null,
				surface,
			}),
		);
		expect(graphics.calls.at(-1)).toEqual({
			args: [],
			name: "clear",
		});
	});

	it.each([
		{
			expectedQuadratics: [
				[
					10,
					20,
					13.6,
					20,
				],
			],
			kind: "board",
			slot: {
				x: 0,
				y: 0,
			},
		},
		{
			expectedQuadratics: [
				[
					70,
					80,
					66.4,
					80,
				],
			],
			kind: "inventory",
			slot: {
				x: 1,
				y: 1,
			},
		},
		{
			expectedQuadratics: [
				[
					10,
					50,
					10,
					46.4,
				],
				[
					10,
					20,
					13.6,
					20,
				],
			],
			kind: "toolbar",
			slot: {
				x: 0,
				y: 0,
			},
		},
	] as const)("rounds only the outer $kind slot corners that meet its surface outline", ({
		expectedQuadratics,
		kind,
		slot,
	}) => {
		const graphics = new FakeGraphics();
		const targetSurface = {
			...surface,
			height: kind === "toolbar" ? 30 : surface.height,
			kind,
			rows: kind === "toolbar" ? 1 : surface.rows,
		} satisfies PixiGridSurfaceLayout;

		Effect.runSync(
			drawPixiGridDropFeedbackFx({
				color: 0xabcdef,
				graphics: asGraphics(graphics),
				slot,
				surface: targetSurface,
			}),
		);

		expect(graphics.calls.some(({ name }) => name === "rect")).toBe(false);
		const roundedCorners = graphics.calls
			.filter(({ name }) => name === "quadraticCurveTo")
			.map(({ args }) => args)
			.filter((args) => args[0] !== args[2] || args[1] !== args[3]);
		expect(roundedCorners).toEqual(expectedQuadratics);
		expect(graphics.calls.at(-3)?.name).toBe("closePath");
	});
});
