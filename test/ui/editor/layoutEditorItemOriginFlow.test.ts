import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	type EditorItemOriginFlow,
	readEditorItemOriginFlowFx,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import {
	type EditorItemOriginFlowLayoutInput,
	type EditorItemOriginFlowLayoutPoint,
	layoutEditorItemOriginFlow,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";
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

const expectCubicRoute = (route: ReadonlyArray<EditorItemOriginFlowLayoutPoint>) => {
	expect(route).toHaveLength(4);
	for (const point of route) expectFinitePoint(point);
};

const readBounds = (layout: ReturnType<typeof layoutEditorItemOriginFlow>) => {
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

describe("layoutEditorItemOriginFlow", () => {
	it("lays out a progression chain deterministically in forward flow order", () => {
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
		const layout = layoutEditorItemOriginFlow(flow);
		const shuffled = layoutEditorItemOriginFlow({
			edges: [
				...flow.edges,
			].reverse(),
			nodes: [
				...flow.nodes,
			].reverse(),
		});

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
		expect(layout.positions.get("a")!.flowOrder).toBeLessThan(
			layout.positions.get("operation")!.flowOrder,
		);
		expect(layout.positions.get("operation")!.flowOrder).toBeLessThan(
			layout.positions.get("b")!.flowOrder,
		);
		for (const route of layout.routes.values()) expectCubicRoute(route);
	});

	it("keeps cycles and disconnected components finite", () => {
		const layout = layoutEditorItemOriginFlow({
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
		});

		expect(layout.positions.size).toBe(5);
		expect(layout.routes.size).toBe(4);
		for (const route of layout.routes.values()) expectCubicRoute(route);
		for (const position of layout.positions.values()) {
			expect(Number.isFinite(position.x)).toBe(true);
			expect(Number.isFinite(position.y)).toBe(true);
		}
	});

	it("uses one wide card size without overlap", () => {
		const layout = layoutEditorItemOriginFlow({
			edges: [],
			nodes: Array.from(
				{
					length: 80,
				},
				(_, index) => node(`node-${index}`),
			),
		});
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
			for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
				const right = positions[rightIndex]!;
				const overlaps =
					left.x < right.x + right.width &&
					left.x + left.width > right.x &&
					left.y < right.y + right.height &&
					left.y + left.height > right.y;
				expect(overlaps).toBe(false);
			}
		}
	});

	it("routes same-column edges around the outside of the cards", () => {
		const nodes = Array.from(
			{
				length: 20,
			},
			(_, index) => node(`node-${index}`),
		);
		const edges = nodes
			.slice(0, -1)
			.map((current, index) => edge(current.id, nodes[index + 1]!.id));
		const layout = layoutEditorItemOriginFlow({
			edges,
			nodes,
		});
		const sameColumnEdge = edges.find(
			({ source, target }) =>
				layout.positions.get(source)!.x === layout.positions.get(target)!.x,
		);
		expect(sameColumnEdge).toBeDefined();
		const source = layout.positions.get(sameColumnEdge!.source)!;
		const route = layout.routes.get(sameColumnEdge!.id)!;
		expectCubicRoute(route);
		const outsideRight = route[1]!.x > source.x + source.width;
		const outsideLeft = route[1]!.x < source.x;
		expect(outsideRight || outsideLeft).toBe(true);
	});

	it("packs the official graph into a landscape canvas with few feedback edges", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const startedAt = performance.now();
		const layout = layoutEditorItemOriginFlow(readTopology(flow));
		const elapsedMs = performance.now() - startedAt;
		const bounds = readBounds(layout);

		expect(layout.positions.size).toBe(flow.nodes.length);
		expect(layout.routes.size).toBe(flow.edges.length);
		expect(elapsedMs).toBeLessThan(1_000);
		expect(bounds.width).toBeLessThan(13_000);
		expect(bounds.height).toBeLessThan(7_000);
		expect(bounds.width / bounds.height).toBeGreaterThan(1.3);
		expect(bounds.width / bounds.height).toBeLessThan(2.1);
		for (const route of layout.routes.values()) expectCubicRoute(route);

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
	});
});
