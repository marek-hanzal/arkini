import { Effect } from "effect";
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";

import {
	type EditorItemOriginFlow,
	readEditorItemOriginFlowFx,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import {
	type EditorItemOriginFlowLayoutInput,
	type EditorItemOriginFlowLayoutNode,
	type EditorItemOriginFlowLayoutPoint,
	layoutEditorItemOriginFlow as runEditorItemOriginFlowLayout,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";
import { readEditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const elk = new ELK();
const layoutEditorItemOriginFlow = (flow: EditorItemOriginFlowLayoutInput) =>
	runEditorItemOriginFlowLayout(flow, (graph) => elk.layout(graph));

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

const segmentIntersectsNode = (
	start: EditorItemOriginFlowLayoutPoint,
	end: EditorItemOriginFlowLayoutPoint,
	node: EditorItemOriginFlowLayoutNode,
	clearance: number,
) => {
	const left = node.x - clearance;
	const right = node.x + node.width + clearance;
	const top = node.y - clearance;
	const bottom = node.y + node.height + clearance;
	if (start.x === end.x)
		return (
			start.x > left &&
			start.x < right &&
			Math.max(start.y, end.y) > top &&
			Math.min(start.y, end.y) < bottom
		);
	if (start.y === end.y)
		return (
			start.y > top &&
			start.y < bottom &&
			Math.max(start.x, end.x) > left &&
			Math.min(start.x, end.x) < right
		);
	return true;
};

describe("layoutEditorItemOriginFlow", () => {
	it("lays out and routes a progression chain deterministically", async () => {
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
		const layout = await layoutEditorItemOriginFlow(flow);
		const shuffled = await layoutEditorItemOriginFlow({
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
		expect(layout.positions.get("a")!.x).toBeLessThan(layout.positions.get("operation")!.x);
		expect(layout.positions.get("operation")!.x).toBeLessThan(layout.positions.get("b")!.x);
	});

	it("routes cycles and disconnected components with finite orthogonal segments", async () => {
		const layout = await layoutEditorItemOriginFlow({
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
		for (const route of layout.routes.values()) {
			expect(route.length).toBeGreaterThanOrEqual(2);
			for (const point of route) expectFinitePoint(point);
			for (let index = 1; index < route.length; index += 1) {
				const start = route[index - 1]!;
				const end = route[index]!;
				expect(start.x === end.x || start.y === end.y).toBe(true);
			}
		}
	});

	it("uses the exact fixed card dimensions without node overlap", async () => {
		const layout = await layoutEditorItemOriginFlow({
			edges: [],
			nodes: [
				node("item"),
				node("source", "source"),
			],
		});
		const item = layout.positions.get("item")!;
		const source = layout.positions.get("source")!;

		expect(item).toMatchObject({
			height: 76,
			width: 224,
		});
		expect(source).toMatchObject({
			height: 144,
			width: 256,
		});
		expect(item.y + item.height <= source.y || source.y + source.height <= item.y).toBe(true);
	});

	it("joins a multi-section ELK edge into one continuous route", async () => {
		const layout = await runEditorItemOriginFlowLayout(
			{
				edges: [
					edge("a", "b"),
				],
				nodes: [
					node("a"),
					node("b"),
				],
			},
			async (graph) => ({
				...graph,
				children: graph.children?.map((child, index) => ({
					...child,
					x: index * 300,
					y: 0,
				})),
				edges: graph.edges?.map((entry) => ({
					...entry,
					sections: [
						{
							endPoint: {
								x: 250,
								y: 38,
							},
							id: "first",
							outgoingSections: [
								"second",
							],
							startPoint: {
								x: 227,
								y: 38,
							},
						},
						{
							bendPoints: [
								{
									x: 275,
									y: 38,
								},
							],
							endPoint: {
								x: 297,
								y: 38,
							},
							id: "second",
							incomingSections: [
								"first",
							],
							startPoint: {
								x: 250,
								y: 38,
							},
						},
					],
				})),
			}),
		);

		expect(layout.routes.get("a->b")).toEqual([
			{
				x: 227,
				y: 38,
			},
			{
				x: 250,
				y: 38,
			},
			{
				x: 275,
				y: 38,
			},
			{
				x: 297,
				y: 38,
			},
		]);
	});

	it("keeps every official route away from unrelated nodes", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const startedAt = performance.now();
		const layout = await layoutEditorItemOriginFlow(readTopology(flow));
		const elapsedMs = performance.now() - startedAt;

		expect(layout.positions.size).toBe(flow.nodes.length);
		expect(layout.routes.size).toBe(flow.edges.length);
		expect(elapsedMs).toBeLessThan(10_000);
		let geometryFailure: unknown;
		edges: for (const edge of flow.edges) {
			const route = layout.routes.get(edge.id)!;
			const source = layout.positions.get(edge.source)!;
			const target = layout.positions.get(edge.target)!;
			expect(route[0]).toEqual({
				x: source.x + source.width + 3,
				y: source.y + source.height / 2,
			});
			expect(route.at(-1)).toEqual({
				x: target.x - 3,
				y: target.y + target.height / 2,
			});
			for (let index = 1; index < route.length; index += 1) {
				const start = route[index - 1]!;
				const end = route[index]!;
				if (start.x !== end.x && start.y !== end.y) {
					geometryFailure = {
						edgeId: edge.id,
						end,
						kind: "non-orthogonal",
						start,
					};
					break edges;
				}
				for (const [nodeId, position] of layout.positions) {
					if (nodeId === edge.source || nodeId === edge.target) continue;
					if (!segmentIntersectsNode(start, end, position, 8)) continue;
					geometryFailure = {
						edgeId: edge.id,
						end,
						kind: "node-collision",
						nodeId,
						start,
					};
					break edges;
				}
			}
		}
		expect(geometryFailure).toBeUndefined();

		const winery = readEditorOriginFlowHighlight(flow, {
			id: "item:item:blueprint-winery-t1",
			kind: "node",
		});
		expect(winery.nodeIds).toContain(
			"source:item:blueprint-winery-t1:line:line:blueprint:winery-t1:construct:single-set:guaranteed:drop",
		);
		expect(winery.nodeIds).toContain("item:producer:winery-t1");
	});
});
