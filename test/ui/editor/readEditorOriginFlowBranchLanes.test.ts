import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	type EditorItemOriginEdge,
	readEditorItemOriginFlowFx,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowBranchLanes } from "~/ui/item/editor/readEditorOriginFlowBranchLanes";
import {
	type EditorOriginFlowHighlight,
	readEditorOriginFlowHighlight,
} from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { readEditorOriginFlowNodeMetrics } from "~/ui/item/editor/readEditorOriginFlowNodeMetrics";
import {
	type EditorItemOriginFlowLayoutNode,
	type EditorItemOriginFlowLayoutPoint,
	layoutEditorItemOriginFlowFx,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const edge = (id: string, source: string, target: string): EditorItemOriginEdge => ({
	id,
	operationId: `operation:${id}`,
	role: "output",
	source,
	sourcePortId: `port:${id}:out`,
	target,
	targetPortId: `port:${id}:in`,
});

const position = (
	x: number,
	y: number,
	width = 80,
	height = 80,
): EditorItemOriginFlowLayoutNode => ({
	flowOrder: 0,
	height,
	width,
	x,
	y,
});

const sharedBackbones = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>([
	[
		"edge:a",
		[
			{
				x: 0,
				y: 0,
			},
			{
				x: 40,
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
				y: 0,
			},
			{
				x: 340,
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
				x: 40,
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
				y: 160,
			},
			{
				x: 340,
				y: 160,
			},
		],
	],
]);

const highlight: EditorOriginFlowHighlight = {
	branchIndexesByEdgeId: new Map([
		[
			"edge:a",
			[
				0,
			],
		],
		[
			"edge:b",
			[
				1,
			],
		],
	]),
	edgeIds: new Set([
		"edge:a",
		"edge:b",
	]),
	nodeIds: new Set([
		"source:a",
		"source:b",
		"target:a",
		"target:b",
	]),
};

const edges = [
	edge("edge:a", "source:a", "target:a"),
	edge("edge:b", "source:b", "target:b"),
];

const positions = new Map<string, EditorItemOriginFlowLayoutNode>([
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
		position(340, -40),
	],
	[
		"target:b",
		position(340, 120),
	],
]);

describe("readEditorOriginFlowBranchLanes", () => {
	it("separates different branches that share the same corridor segment", () => {
		const lanes = readEditorOriginFlowBranchLanes(edges, sharedBackbones, positions, highlight);
		const first = lanes.get("edge:a")?.get(0);
		const second = lanes.get("edge:b")?.get(1);

		expect(first).toBeDefined();
		expect(second).toBeDefined();
		expect(first?.[0]).toEqual(sharedBackbones.get("edge:a")?.[0]);
		expect(first?.at(-1)).toEqual(sharedBackbones.get("edge:a")?.at(-1));
		expect(second?.[0]).toEqual(sharedBackbones.get("edge:b")?.[0]);
		expect(second?.at(-1)).toEqual(sharedBackbones.get("edge:b")?.at(-1));
		expect(first).not.toEqual(second);
		expect(first?.[2]?.y).not.toBeCloseTo(second?.[2]?.y ?? Number.NaN, 5);
	});

	it("separates shared lanes in the official Coin Income graph without rerouting", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const topology = {
			edges: flow.edges.map(({ id, source, sourcePortId, target, targetPortId }) => ({
				id,
				source,
				sourcePortId,
				target,
				targetPortId,
			})),
			nodes: flow.nodes.map((node) => {
				const metrics = readEditorOriginFlowNodeMetrics(node);
				return {
					height: metrics.height,
					id: node.id,
					ports: [
						...metrics.portOffsets,
					].map(([id, point]) => ({
						id,
						...point,
					})),
					width: metrics.width,
				};
			}),
		};
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(topology));
		const highlight = readEditorOriginFlowHighlight(flow, layout.positions, {
			id: "item:item:coin",
			kind: "node",
		});
		const startedAt = performance.now();
		const lanes = readEditorOriginFlowBranchLanes(
			flow.edges,
			layout.backbones,
			layout.positions,
			highlight,
		);
		const elapsedMs = performance.now() - startedAt;
		const branchIndexes = new Set(
			[
				...highlight.branchIndexesByEdgeId.values(),
			].flat(),
		);
		let shiftedLaneCount = 0;
		for (const [edgeId, branchLanes] of lanes) {
			const backbone = layout.backbones.get(edgeId);
			if (backbone === undefined) continue;
			for (const points of branchLanes.values()) {
				if (
					points.some((point, index) => {
						const base = backbone[index];
						return (
							base !== undefined &&
							Math.hypot(point.x - base.x, point.y - base.y) > 0.5
						);
					})
				)
					shiftedLaneCount += 1;
			}
		}

		expect(branchIndexes.size).toBeGreaterThan(5);
		expect(lanes.size).toBeGreaterThan(100);
		expect(shiftedLaneCount).toBeGreaterThan(20);
		expect(elapsedMs).toBeLessThan(1_000);
	}, 20_000);

	it("is deterministic for the same selected Income graph", () => {
		const first = readEditorOriginFlowBranchLanes(edges, sharedBackbones, positions, highlight);
		const second = readEditorOriginFlowBranchLanes(
			edges,
			sharedBackbones,
			positions,
			highlight,
		);

		expect([
			...first,
		]).toEqual([
			...second,
		]);
	});
});
