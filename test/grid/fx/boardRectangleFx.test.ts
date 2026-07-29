import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createBoardRectangleFx } from "~/engine/grid/fx/createBoardRectangleFx";
import { readBoardRectangleChebyshevDistanceFx } from "~/engine/grid/fx/readBoardRectangleChebyshevDistanceFx";
import { readBoardRectangleLocationsFx } from "~/engine/grid/fx/readBoardRectangleLocationsFx";
import { readBoardRectangleManhattanGapFx } from "~/engine/grid/fx/readBoardRectangleManhattanGapFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

const rectangle = (
	x: number,
	y: number,
	width: number,
	height: number,
	space = 0,
): BoardRectangleSchema.Type => {
	return {
		space,
		anchor: {
			x,
			y,
		},
		footprint: {
			width,
			height,
		},
	};
};

describe("Board rectangle geometry", () => {
	it("captures the exact Board space, anchor, and effective footprint", () => {
		const result = Effect.runSync(
			createBoardRectangleFx({
				anchor: {
					scope: "board",
					space: 2,
					position: {
						x: 4,
						y: 3,
					},
				},
				footprint: {
					width: 3,
					height: 2,
				},
			}),
		);

		expect(result).toEqual(rectangle(4, 3, 3, 2, 2));
	});

	it("reads minimum cell-to-cell Chebyshev distance for same-space rectangles", () => {
		const owner = rectangle(1, 1, 3, 2);

		expect(
			Effect.runSync(
				readBoardRectangleChebyshevDistanceFx({
					left: owner,
					right: rectangle(4, 3, 2, 2),
				}),
			),
		).toBe(1);
		expect(
			Effect.runSync(
				readBoardRectangleChebyshevDistanceFx({
					left: owner,
					right: rectangle(6, 5, 1, 1),
				}),
			),
		).toBe(3);
		expect(() =>
			Effect.runSync(
				readBoardRectangleChebyshevDistanceFx({
					left: owner,
					right: rectangle(1, 1, 1, 1, 1),
				}),
			),
		).toThrow("Cannot read Board rectangle distance across spaces 0 and 1.");
	});

	it("reads minimum cell-to-cell Manhattan gap for same-space rectangles", () => {
		const owner = rectangle(1, 1, 3, 2);

		expect(
			Effect.runSync(
				readBoardRectangleManhattanGapFx({
					left: owner,
					right: rectangle(4, 3, 2, 2),
				}),
			),
		).toBe(2);
		expect(
			Effect.runSync(
				readBoardRectangleManhattanGapFx({
					left: owner,
					right: rectangle(6, 5, 1, 1),
				}),
			),
		).toBe(6);
		expect(() =>
			Effect.runSync(
				readBoardRectangleManhattanGapFx({
					left: owner,
					right: rectangle(1, 1, 1, 1, 1),
				}),
			),
		).toThrow("Cannot read Board rectangle gap across spaces 0 and 1.");
	});

	it("enumerates occupied Board cells in deterministic row-major order", () => {
		expect(
			Effect.runSync(
				readBoardRectangleLocationsFx({
					rectangle: rectangle(2, 3, 2, 2, 4),
				}),
			),
		).toEqual([
			{
				scope: "board",
				space: 4,
				position: {
					x: 2,
					y: 3,
				},
			},
			{
				scope: "board",
				space: 4,
				position: {
					x: 3,
					y: 3,
				},
			},
			{
				scope: "board",
				space: 4,
				position: {
					x: 2,
					y: 4,
				},
			},
			{
				scope: "board",
				space: 4,
				position: {
					x: 3,
					y: 4,
				},
			},
		]);
	});
});
