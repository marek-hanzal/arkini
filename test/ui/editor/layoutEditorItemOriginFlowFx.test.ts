import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	type EditorItemOriginFlow,
	readEditorItemOriginFlowFx,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import {
	type EditorItemOriginFlowLayout,
	type EditorItemOriginFlowLayoutInput,
	type EditorItemOriginFlowLayoutNode,
	type EditorItemOriginFlowLayoutPoint,
	layoutEditorItemOriginFlowFx,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { readEditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { readEditorOriginFlowNodeMetrics } from "~/ui/item/editor/readEditorOriginFlowNodeMetrics";
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
		const metrics = readEditorOriginFlowNodeMetrics(flowNode);
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

const readLongestHorizontalSegment = (points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>) => {
	let longest:
		| {
				readonly length: number;
				readonly y: number;
		  }
		| undefined;
	for (let index = 1; index < points.length; index += 1) {
		const from = points[index - 1]!;
		const to = points[index]!;
		if (Math.abs(from.y - to.y) >= 0.01) continue;
		const length = Math.abs(to.x - from.x);
		if (longest === undefined || length > longest.length)
			longest = {
				length,
				y: from.y,
			};
	}
	return longest;
};

describe("layoutEditorItemOriginFlowFx", () => {
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

	it("routes exactly between explicit item ports", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					edge("source", "target", {
						sourcePortId: "out",
						targetPortId: "in",
					}),
				],
				nodes: [
					node("source", {
						height: 260,
						ports: [
							{
								id: "out",
								x: 210,
								y: 62,
							},
						],
					}),
					node("target", {
						height: 420,
						ports: [
							{
								id: "in",
								x: -210,
								y: -118,
							},
						],
					}),
				],
			}),
		);
		const source = layout.positions.get("source")!;
		const target = layout.positions.get("target")!;
		const backbone = layout.backbones.get("source->target")!;
		const start = backbone[0]!;
		const end = backbone.at(-1)!;

		expect(start.x).toBeCloseTo(source.x + source.width, 5);
		expect(start.y).toBeCloseTo(source.y + source.height / 2 + 62, 5);
		expect(end.x).toBeCloseTo(target.x, 5);
		expect(end.y).toBeCloseTo(target.y + target.height / 2 - 118, 5);
		expectOrthogonalRoute(backbone);
		expect(backbone[1]!.x - start.x).toBeGreaterThanOrEqual(56);
		expect(backbone[1]!.x - start.x).toBeLessThan(152);
		expect(backbone[1]!.x % 96).toBeCloseTo(0, 5);
		expect(backbone[1]!.y).toBeCloseTo(start.y, 5);
		expect(end.x - backbone.at(-2)!.x).toBeGreaterThanOrEqual(56);
		expect(end.x - backbone.at(-2)!.x).toBeLessThan(152);
		expect(backbone.at(-2)!.x % 96).toBeCloseTo(0, 5);
		expect(backbone.at(-2)!.y).toBeCloseTo(end.y, 5);
	});

	it("bundles overlapping long cables onto stable shared tracks", () => {
		const edges = Array.from(
			{
				length: 20,
			},
			(_, index) => ({
				id: `parallel-${index.toString().padStart(2, "0")}`,
				source: "source",
				target: "target",
			}),
		);
		const flow: EditorItemOriginFlowLayoutInput = {
			edges,
			nodes: [
				node("source"),
				node("target"),
			],
		};
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(flow));
		const shuffled = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					...edges,
				].reverse(),
				nodes: [
					...flow.nodes,
				].reverse(),
			}),
		);

		expect([
			...layout.backbones,
		]).toEqual([
			...shuffled.backbones,
		]);
		const routes = edges.map(({ id }) => layout.backbones.get(id)!);
		expect(new Set(routes.map((route) => JSON.stringify(route))).size).toBe(1);
		const laneYs = routes
			.map((route) => readLongestHorizontalSegment(route)?.y)
			.filter((value): value is number => value !== undefined);
		expect(new Set(laneYs).size).toBe(1);
		expect(laneYs[0]! % 96).toBeCloseTo(0, 5);
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
						readEditorOriginFlowNodeMetrics(flowNode),
					] as const,
			),
		);

		expect(flow.nodes.length).toBe(247);
		expect(flow.edges.length).toBe(1384);
		expect(flow.nodes.every(({ kind }) => kind === "item")).toBe(true);
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

		const waterNode = flow.nodes.find(({ title }) => title === "Water");
		const libraryNode = flow.nodes.find(({ title }) => title === "Library IV");
		expect(waterNode).toBeDefined();
		expect(libraryNode).toBeDefined();
		const waterLayout = layout.positions.get(waterNode!.id)!;
		const libraryLayout = layout.positions.get(libraryNode!.id)!;
		expect(waterLayout.degree).toBeGreaterThan(40);
		expect(libraryLayout.degree).toBeGreaterThan(60);
		expect(libraryLayout.portCount).toBeGreaterThan(100);
		expect(waterLayout.importance).toBeGreaterThan(0.5);
		expect(libraryLayout.importance).toBeGreaterThan(waterLayout.importance);

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

		const winery = readEditorOriginFlowHighlight(flow, layout.positions, {
			id: "item:item:blueprint-winery-t1",
			kind: "node",
		});
		expect(winery.nodeIds.has("item:item:blueprint-winery-t1")).toBe(true);
		expect(winery.nodeIds.size).toBeGreaterThan(1);
		expect(winery.edgeIds.size).toBeGreaterThan(0);
	}, 20_000);
});
