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
		expect(
			readBoardEdgePanFn({
				...input,
				height: 1000,
				pointerY: 0,
			}),
		).toEqual({
			x: -40,
			y: -200,
		});
		expect(
			readBoardEdgePanFn({
				...input,
				scale: 0.5,
				pointerY: 0,
			}),
		).toEqual({
			x: -100,
			y: -200,
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

	it("moves smoothly back from free-pan overscroll and never moves farther out", () => {
		expect(
			readBoardEdgePanFn({
				...input,
				x: 300,
			}),
		).toEqual({
			x: 300,
			y: -200,
		});
		expect(
			readBoardEdgePanFn({
				...input,
				x: 300,
				pointerX: 800,
			}),
		).toEqual({
			x: 240,
			y: -200,
		});
		expect(
			readBoardEdgePanFn({
				...input,
				x: -500,
				pointerX: 800,
			}),
		).toEqual({
			x: -500,
			y: -200,
		});
		expect(
			readBoardEdgePanFn({
				...input,
				x: -500,
			}),
		).toEqual({
			x: -440,
			y: -200,
		});
	});

	it("uses elapsed frame time and accelerates toward the viewport edge", () => {
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
		expect(
			readBoardEdgePanFn({
				...input,
				pointerX: 30,
			}).x,
		).toBe(-70);
		expect(
			readBoardEdgePanFn({
				...input,
				pointerX: 60,
			}).x,
		).toBe(-100);
	});

	it("stops for pointers outside the viewport and keeps the tiny viewport center neutral", () => {
		for (const pointer of [
			{
				pointerX: -1,
			},
			{
				pointerX: 801,
			},
			{
				pointerY: -1,
			},
			{
				pointerY: 601,
			},
		]) {
			expect(
				readBoardEdgePanFn({
					...input,
					...pointer,
				}),
			).toEqual({
				x: -100,
				y: -200,
			});
		}
		expect(
			readBoardEdgePanFn({
				...input,
				width: 80,
				height: 80,
				pointerX: 40,
				pointerY: 40,
			}),
		).toEqual({
			x: -100,
			y: -200,
		});
	});
});
