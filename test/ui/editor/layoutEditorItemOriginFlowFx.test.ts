import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { type EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import { readEditorItemOriginFlowFx } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import type {
	EditorItemOriginFlowLayout,
	EditorItemOriginFlowLayoutInput,
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { layoutEditorItemOriginFlowFx } from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { readEditorOriginFlowHighlightFx } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowNodeMetricsFx } from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const node = (
	id: string,
	{
		height = 176,
		ports = [],
		width = 420,
	}: {
		readonly height?: number;
		readonly ports?: ReadonlyArray<{
			readonly id: string;
			readonly x: number;
			readonly y: number;
		}>;
		readonly width?: number;
	} = {},
) => ({
	id,
	height,
	ports,
	type: "simple" as const,
	width,
});

const edge = (
	source: string,
	target: string,
	ports: {
		readonly sourcePortId?: string;
		readonly targetPortId?: string;
	} = {},
) => ({
	id: `${source}->${target}`,
	source,
	target,
	...ports,
});

const readTopology = (flow: EditorItemOriginFlow): EditorItemOriginFlowLayoutInput => ({
	edges: flow.edges.map(({ id, source, sourcePortId, target, targetPortId }) => ({
		id,
		source,
		sourcePortId,
		target,
		targetPortId,
	})),
	nodes: flow.nodes.map((flowNode) => {
		const metrics = Effect.runSync(readEditorOriginFlowNodeMetricsFx(flowNode));
		return {
			height: metrics.height,
			id: flowNode.id,
			ports: [
				...metrics.portOffsets,
			].map(([id, point]) => ({
				id,
				...point,
			})),
			type: flowNode.type,
			width: metrics.width,
		};
	}),
});

const expectFinitePoint = ({ x, y }: EditorItemOriginFlowLayoutPoint) => {
	expect(Number.isFinite(x)).toBe(true);
	expect(Number.isFinite(y)).toBe(true);
};

const readBounds = (layout: EditorItemOriginFlowLayout) => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const position of layout.positions.values()) {
		minX = Math.min(minX, position.x);
		minY = Math.min(minY, position.y);
		maxX = Math.max(maxX, position.x + position.width);
		maxY = Math.max(maxY, position.y + position.height);
	}
	return {
		height: maxY - minY,
		width: maxX - minX,
	};
};

const overlaps = (left: EditorItemOriginFlowLayoutNode, right: EditorItemOriginFlowLayoutNode) =>
	left.x < right.x + right.width &&
	left.x + left.width > right.x &&
	left.y < right.y + right.height &&
	left.y + left.height > right.y;

const expectOrthogonalRoute = (
	points: ReadonlyArray<{
		readonly x: number;
		readonly y: number;
	}>,
) => {
	expect(points.length).toBeGreaterThanOrEqual(4);
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1]!;
		const current = points[index]!;
		expect(
			Math.abs(previous.x - current.x) < 0.01 || Math.abs(previous.y - current.y) < 0.01,
		).toBe(true);
	}
};

describe("layoutEditorItemOriginFlowFx", () => {
	it("keeps an empty topology empty", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [],
				nodes: [],
			}),
		);

		expect(layout.positions.size).toBe(0);
		expect(layout.backbones.size).toBe(0);
	});

	it("keeps a deterministic forward order independent of input order", () => {
		const flow: EditorItemOriginFlowLayoutInput = {
			edges: [
				edge("a", "b"),
				edge("b", "c"),
			],
			nodes: [
				node("c"),
				node("a"),
				node("b"),
			],
		};
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(flow));
		const shuffled = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					...flow.edges,
				].reverse(),
				nodes: [
					...flow.nodes,
				].reverse(),
			}),
		);

		expect([
			...layout.positions,
		]).toEqual([
			...shuffled.positions,
		]);
		expect([
			...layout.backbones,
		]).toEqual([
			...shuffled.backbones,
		]);
		expect(layout.positions.get("a")!.flowOrder).toBeLessThan(
			layout.positions.get("b")!.flowOrder,
		);
		expect(layout.positions.get("b")!.flowOrder).toBeLessThan(
			layout.positions.get("c")!.flowOrder,
		);
		for (const backbone of layout.backbones.values()) {
			expectOrthogonalRoute(backbone);
			for (const point of backbone) expectFinitePoint(point);
		}
	});

	it("keeps cycles and disconnected components finite", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					edge("a", "b"),
					edge("b", "a"),
					edge("x", "y"),
					edge("y", "x"),
				],
				nodes: [
					node("a"),
					node("b"),
					node("x"),
					node("y"),
					node("isolated"),
				],
			}),
		);

		expect(layout.positions.size).toBe(5);
		expect(layout.backbones.size).toBe(4);
		for (const backbone of layout.backbones.values()) {
			expectOrthogonalRoute(backbone);
			for (const point of backbone) expectFinitePoint(point);
		}
		for (const position of layout.positions.values()) {
			expect(Number.isFinite(position.x)).toBe(true);
			expect(Number.isFinite(position.y)).toBe(true);
		}
	});

	it("preserves variable item sizes without overlap", () => {
		const inputNodes = Array.from(
			{
				length: 80,
			},
			(_, index) =>
				node(`node-${index}`, {
					height: 176 + (index % 7) * 70,
				}),
		);
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [],
				nodes: inputNodes,
			}),
		);
		const positions = [
			...layout.positions.values(),
		];

		for (const [index, position] of positions.entries()) {
			const input = inputNodes.find(
				({ id }) =>
					id ===
					[
						...layout.positions.keys(),
					][index],
			);
			expect(input).toBeDefined();
			expect(position.height).toBeCloseTo(input!.height, 5);
			expect(position.width).toBeCloseTo(input!.width, 5);
		}
		for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1)
				expect(overlaps(positions[leftIndex]!, positions[rightIndex]!)).toBe(false);
		}
	});

	it("lays out the official item-only graph with exact embedded-operation ports", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const topology = readTopology(flow);
		const startedAt = performance.now();
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(topology));
		const elapsedMs = performance.now() - startedAt;
		const bounds = readBounds(layout);
		const metricsById = new Map(
			flow.nodes.map(
				(flowNode) =>
					[
						flowNode.id,
						Effect.runSync(readEditorOriginFlowNodeMetricsFx(flowNode)),
					] as const,
			),
		);

		expect(layout.positions.size).toBe(flow.nodes.length);
		expect(layout.backbones.size).toBe(flow.edges.length);
		expect(elapsedMs).toBeLessThan(5_000);
		expect(bounds.width).toBeLessThan(24_000);
		expect(bounds.height).toBeLessThan(22_000);
		expect(bounds.width / bounds.height).toBeGreaterThan(0.8);
		expect(bounds.width / bounds.height).toBeLessThan(1.5);
		for (const backbone of layout.backbones.values()) {
			expectOrthogonalRoute(backbone);
			for (const point of backbone) expectFinitePoint(point);
		}

		const layoutNodes = [
			...layout.positions.values(),
		];
		for (let leftIndex = 0; leftIndex < layoutNodes.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < layoutNodes.length; rightIndex += 1)
				expect(overlaps(layoutNodes[leftIndex]!, layoutNodes[rightIndex]!)).toBe(false);
		}

		for (const flowEdge of flow.edges) {
			const source = layout.positions.get(flowEdge.source)!;
			const target = layout.positions.get(flowEdge.target)!;
			const sourceMetrics = metricsById.get(flowEdge.source)!;
			const targetMetrics = metricsById.get(flowEdge.target)!;
			const sourceOffset =
				flowEdge.sourcePortId === undefined
					? {
							x: source.width / 2,
							y: 0,
						}
					: sourceMetrics.portOffsets.get(flowEdge.sourcePortId)!;
			const targetOffset =
				flowEdge.targetPortId === undefined
					? {
							x: -target.width / 2,
							y: 0,
						}
					: targetMetrics.portOffsets.get(flowEdge.targetPortId)!;
			const backbone = layout.backbones.get(flowEdge.id)!;
			const first = backbone[0]!;
			const last = backbone.at(-1)!;
			expect(first.x).toBeCloseTo(source.x + source.width / 2 + sourceOffset.x, 5);
			expect(first.y).toBeCloseTo(source.y + source.height / 2 + sourceOffset.y, 5);
			expect(last.x).toBeCloseTo(target.x + target.width / 2 + targetOffset.x, 5);
			expect(last.y).toBeCloseTo(target.y + target.height / 2 + targetOffset.y, 5);
		}

		const winery = Effect.runSync(
			readEditorOriginFlowHighlightFx(flow, {
				id: "item:item:blueprint-winery-t1",
				kind: "node",
			}),
		);
		expect(winery.nodeIds.has("item:item:blueprint-winery-t1")).toBe(true);
		expect(winery.nodeIds.size).toBeGreaterThan(1);
		expect(winery.edgeIds.size).toBeGreaterThan(0);
	}, 20_000);
});
