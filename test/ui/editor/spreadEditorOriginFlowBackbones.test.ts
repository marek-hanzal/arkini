import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlowLayoutNode } from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { spreadEditorOriginFlowBackbones } from "~/ui/item/editor/spreadEditorOriginFlowBackbones";

const position = (x: number, y: number): EditorItemOriginFlowLayoutNode => ({
	flowOrder: 0,
	height: 80,
	width: 80,
	x,
	y,
});

const edges = [
	{
		id: "edge:a",
		source: "source:a",
		target: "target:a",
	},
	{
		id: "edge:b",
		source: "source:b",
		target: "target:b",
	},
];

const backbones = new Map([
	[
		"edge:a",
		[
			{
				x: 0,
				y: 0,
			},
			{
				x: 56,
				y: 0,
			},
			{
				x: 100,
				y: 0,
			},
			{
				x: 100,
				y: 80,
			},
			{
				x: 240,
				y: 80,
			},
			{
				x: 300,
				y: 80,
			},
			{
				x: 300,
				y: 0,
			},
			{
				x: 356,
				y: 0,
			},
		],
	],
	[
		"edge:b",
		[
			{
				x: 0,
				y: 160,
			},
			{
				x: 56,
				y: 160,
			},
			{
				x: 100,
				y: 160,
			},
			{
				x: 100,
				y: 80,
			},
			{
				x: 240,
				y: 80,
			},
			{
				x: 300,
				y: 80,
			},
			{
				x: 300,
				y: 160,
			},
			{
				x: 356,
				y: 160,
			},
		],
	],
] as const);

const positions = new Map([
	[
		"source:a",
		position(-80, -40),
	],
	[
		"source:b",
		position(-80, 120),
	],
	[
		"target:a",
		position(356, -40),
	],
	[
		"target:b",
		position(356, 120),
	],
]);

describe("spreadEditorOriginFlowBackbones", () => {
	it("gives overlapping physical edges stable separate lanes while preserving endpoints", () => {
		const spread = spreadEditorOriginFlowBackbones(edges, backbones, positions);
		const first = spread.get("edge:a")!;
		const second = spread.get("edge:b")!;

		expect(first[0]).toEqual(backbones.get("edge:a")![0]);
		expect(first.at(-1)).toEqual(backbones.get("edge:a")!.at(-1));
		expect(second[0]).toEqual(backbones.get("edge:b")![0]);
		expect(second.at(-1)).toEqual(backbones.get("edge:b")!.at(-1));
		expect(first).not.toEqual(second);
		const readLongestHorizontalY = (
			points: ReadonlyArray<{
				readonly x: number;
				readonly y: number;
			}>,
		) => {
			let longest = 0;
			let y: number | undefined;
			for (let index = 1; index < points.length; index += 1) {
				const from = points[index - 1]!;
				const to = points[index]!;
				if (Math.abs(from.y - to.y) > 0.01) continue;
				const length = Math.abs(to.x - from.x);
				if (length <= longest) continue;
				longest = length;
				y = from.y;
			}
			return y;
		};
		expect(readLongestHorizontalY(first)).not.toBeCloseTo(80, 5);
		expect(readLongestHorizontalY(second)).not.toBeCloseTo(80, 5);
		expect(readLongestHorizontalY(first)).not.toBeCloseTo(readLongestHorizontalY(second)!, 5);
	});

	it("bundles dense hub terminals into a bounded number of local tracks", () => {
		const hubEdges = Array.from(
			{
				length: 20,
			},
			(_, index) => ({
				id: `edge:${index}`,
				source: `source:${index}`,
				target: "hub",
			}),
		);
		const hubBackbones = new Map(
			hubEdges.map((edge, index) => {
				const portY = 30 + index * 30;
				const sourceY = -240 + index * 58;
				return [
					edge.id,
					[
						{
							x: 0,
							y: sourceY,
						},
						{
							x: 56,
							y: sourceY,
						},
						{
							x: 300,
							y: sourceY,
						},
						{
							x: 300,
							y: portY,
						},
						{
							x: 444,
							y: portY,
						},
						{
							x: 500,
							y: portY,
						},
					],
				] as const;
			}),
		);
		const hubPositions = new Map([
			[
				"hub",
				{
					...position(500, 0),
					height: 660,
				},
			],
		]);

		const spread = spreadEditorOriginFlowBackbones(hubEdges, hubBackbones, hubPositions);
		const tracks = new Set<string>();
		for (const edge of hubEdges) {
			const points = spread.get(edge.id)!;
			for (
				let index = points.length - 2;
				index >= Math.max(1, points.length - 6);
				index -= 1
			) {
				const from = points[index - 1]!;
				const to = points[index]!;
				if (Math.abs(from.x - to.x) >= 0.1 || Math.abs(from.x - 500) > 240) continue;
				tracks.add(from.x.toFixed(1));
				break;
			}
		}

		expect(tracks.size).toBeLessThanOrEqual(2);
	});

	it("is deterministic", () => {
		const first = spreadEditorOriginFlowBackbones(edges, backbones, positions);
		const second = spreadEditorOriginFlowBackbones(
			[
				...edges,
			].reverse(),
			backbones,
			positions,
		);

		expect([
			...first,
		]).toEqual([
			...second,
		]);
	});
});
