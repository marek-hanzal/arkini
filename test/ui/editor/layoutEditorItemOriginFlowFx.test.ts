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
	type EditorItemOriginFlowLayoutRouteSegment,
	layoutEditorItemOriginFlowFx,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { readEditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const node = (id: string, kind: "item" | "source" = "item") => ({
	id,
	kind,
});
const edge = (source: string, target: string) => ({
	id: `${source}->${target}`,
	source,
	target,
});
const readTopology = (flow: EditorItemOriginFlow): EditorItemOriginFlowLayoutInput => ({
	edges: flow.edges.map(({ id, source, target }) => ({
		id,
		source,
		target,
	})),
	nodes: flow.nodes.map(({ id, kind }) => ({
		id,
		kind,
	})),
});

const expectFinitePoint = ({ x, y }: EditorItemOriginFlowLayoutPoint) => {
	expect(Number.isFinite(x)).toBe(true);
	expect(Number.isFinite(y)).toBe(true);
};

const expectValidRoute = (route: ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>) => {
	expect(route.length).toBeGreaterThan(0);
	let previous: EditorItemOriginFlowLayoutPoint | undefined;
	for (const segment of route) {
		expectFinitePoint(segment.from);
		expectFinitePoint(segment.to);
		if (segment.kind === "cubic") {
			expectFinitePoint(segment.control1);
			expectFinitePoint(segment.control2);
		}
		if (previous !== undefined) {
			expect(segment.from.x).toBeCloseTo(previous.x, 5);
			expect(segment.from.y).toBeCloseTo(previous.y, 5);
		}
		previous = segment.to;
	}
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

describe("layoutEditorItemOriginFlowFx", () => {
	it("keeps a deterministic forward order independent of input order", () => {
		const flow: EditorItemOriginFlowLayoutInput = {
			edges: [
				edge("a", "operation"),
				edge("operation", "b"),
			],
			nodes: [
				node("b"),
				node("a"),
				node("operation", "source"),
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
			...layout.routes,
		]).toEqual([
			...shuffled.routes,
		]);
		expect(layout.positions.get("a")!.flowOrder).toBe(shuffled.positions.get("a")!.flowOrder);
		expect(layout.positions.get("operation")!.flowOrder).toBe(
			shuffled.positions.get("operation")!.flowOrder,
		);
		expect(layout.positions.get("b")!.flowOrder).toBe(shuffled.positions.get("b")!.flowOrder);
		expect(layout.positions.get("a")!.flowOrder).toBeLessThan(
			layout.positions.get("operation")!.flowOrder,
		);
		expect(layout.positions.get("operation")!.flowOrder).toBeLessThan(
			layout.positions.get("b")!.flowOrder,
		);
		for (const route of layout.routes.values()) expectValidRoute(route);
	});

	it("keeps cycles and disconnected components finite", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					edge("a", "operation"),
					edge("operation", "a"),
					edge("x", "y"),
					edge("y", "x"),
				],
				nodes: [
					node("a"),
					node("operation", "source"),
					node("x"),
					node("y", "source"),
					node("isolated"),
				],
			}),
		);

		expect(layout.positions.size).toBe(5);
		expect(layout.routes.size).toBe(4);
		for (const route of layout.routes.values()) expectValidRoute(route);
		for (const position of layout.positions.values()) {
			expect(Number.isFinite(position.x)).toBe(true);
			expect(Number.isFinite(position.y)).toBe(true);
		}
	});

	it("uses one wide card size without overlap", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [],
				nodes: Array.from(
					{
						length: 80,
					},
					(_, index) => node(`node-${index}`),
				),
			}),
		);
		const positions = [
			...layout.positions.values(),
		];
		for (const position of positions)
			expect(position).toMatchObject({
				height: 176,
				width: 420,
			});
		for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
			const left = positions[leftIndex]!;
			for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1)
				expect(overlaps(left, positions[rightIndex]!)).toBe(false);
		}
	});

	it("lays out and routes the official graph as an organic landscape while preserving highlight flow order", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const startedAt = performance.now();
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(readTopology(flow)));
		const elapsedMs = performance.now() - startedAt;
		const bounds = readBounds(layout);

		expect(flow.nodes.length).toBe(756);
		expect(flow.edges.length).toBe(1995);
		expect(layout.positions.size).toBe(flow.nodes.length);
		expect(layout.routes.size).toBe(flow.edges.length);
		expect(elapsedMs).toBeLessThan(8_000);
		expect(bounds.width).toBeLessThan(32_000);
		expect(bounds.height).toBeLessThan(22_000);
		expect(bounds.width / bounds.height).toBeGreaterThan(1.3);
		expect(bounds.width / bounds.height).toBeLessThan(2.1);
		for (const route of layout.routes.values()) expectValidRoute(route);

		let feedbackEdges = 0;
		for (const edge of flow.edges) {
			const source = layout.positions.get(edge.source)!;
			const target = layout.positions.get(edge.target)!;
			if (target.flowOrder <= source.flowOrder) feedbackEdges += 1;
		}
		expect(feedbackEdges).toBeLessThan(150);

		const winery = readEditorOriginFlowHighlight(flow, layout.positions, {
			id: "item:item:blueprint-winery-t1",
			kind: "node",
		});
		expect(winery.nodeIds).toContain(
			"source:item:blueprint-winery-t1:line:line:blueprint:winery-t1:construct:single-set:guaranteed:drop",
		);
		expect(winery.nodeIds).toContain("item:producer:winery-t1");
	}, 20_000);
});
