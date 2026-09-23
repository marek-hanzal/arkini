import { describe, expect, it } from "vitest";

import { readBoardEdgePanFn } from "~/game-scene/fn/readBoardEdgePanFn";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

const board = {
	cellSize: 100,
	columns: 10,
	height: 1000,
	kind: "board",
	rows: 10,
	width: 1000,
	x: 20,
	y: 30,
} satisfies SurfaceLayout;
const input = {
	board,
	width: 800,
	height: 600,
	x: -100,
	y: -200,
	scale: 1,
	pointerX: 0,
	pointerY: 300,
	deltaMs: 100,
};

describe("readBoardEdgePanFn", () => {
	it("moves only overflowing axes, leaving a fitted board still", () => {
		const overflowing = readBoardEdgePanFn({
			...input,
			height: 1000,
			pointerY: 0,
		});
		expect(overflowing.x).toBeGreaterThan(input.x);
		expect(overflowing.y).toBe(input.y);
		expect(
			readBoardEdgePanFn({
				...input,
				scale: 0.5,
				pointerY: 0,
			}),
		).toEqual({
			x: input.x,
			y: input.y,
		});
	});

	it("caps both directions at one scaled tile beyond offset board boundaries", () => {
		const zoomed = {
			...input,
			scale: 2,
			deltaMs: 10000,
		};
		expect(
			readBoardEdgePanFn({
				...zoomed,
				pointerY: 0,
			}),
		).toEqual({
			x: 160,
			y: 140,
		});
		expect(
			readBoardEdgePanFn({
				...zoomed,
				pointerX: 800,
				pointerY: 600,
			}),
		).toEqual({
			x: -1440,
			y: -1660,
		});
	});

	it("moves back from free-pan overscroll without snapping or moving farther out", () => {
		const beyondLeft = {
			...input,
			x: 300,
		};
		expect(readBoardEdgePanFn(beyondLeft).x).toBe(beyondLeft.x);
		const returningLeft = readBoardEdgePanFn({
			...beyondLeft,
			pointerX: 800,
		}).x;
		expect(returningLeft).toBeLessThan(beyondLeft.x);
		expect(returningLeft).toBeGreaterThan(80);

		const beyondRight = {
			...input,
			x: -500,
			pointerX: 800,
		};
		expect(readBoardEdgePanFn(beyondRight).x).toBe(beyondRight.x);
		const returningRight = readBoardEdgePanFn({
			...beyondRight,
			pointerX: 0,
		}).x;
		expect(returningRight).toBeGreaterThan(beyondRight.x);
		expect(returningRight).toBeLessThan(-320);
	});

	it("uses elapsed time independently of the number of frames", () => {
		const first = readBoardEdgePanFn({
			...input,
			deltaMs: 50,
		});
		const second = readBoardEdgePanFn({
			...input,
			...first,
			deltaMs: 50,
		});
		expect(second).toEqual(readBoardEdgePanFn(input));
	});

	it("stops when the pointer leaves the viewport", () => {
		expect(
			readBoardEdgePanFn({
				...input,
				pointerX: -1,
			}),
		).toEqual({
			x: input.x,
			y: input.y,
		});
	});
});
