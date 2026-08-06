import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEditorItemOriginFlowFx } from "~/bridge/item/editor/readEditorItemOriginFlow";
import {
	type EditorItemOriginFlowLayoutInput,
	layoutEditorItemOriginFlow,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";
import { readEditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const node = (id: string, kind: "item" | "source" = "item", starter = false) => ({
	id,
	kind,
	starter,
});
const edge = (source: string, target: string, role: "input" | "output" | "owner" = "output") => ({
	role,
	source,
	target,
});

describe("layoutEditorItemOriginFlow", () => {
	it("lays out a progression chain deterministically regardless of input order", () => {
		const flow: EditorItemOriginFlowLayoutInput = {
			edges: [
				edge("a", "operation", "owner"),
				edge("operation", "b"),
			],
			nodes: [
				node("b"),
				node("a", "item", true),
				node("operation", "source"),
			],
		};
		const positions = layoutEditorItemOriginFlow(flow);
		const shuffled = layoutEditorItemOriginFlow({
			edges: [
				...flow.edges,
			].reverse(),
			nodes: [
				...flow.nodes,
			].reverse(),
		});

		expect([
			...positions,
		]).toEqual([
			...shuffled,
		]);
		expect(positions.get("a")!.x).toBeLessThan(positions.get("operation")!.x);
		expect(positions.get("operation")!.x).toBeLessThan(positions.get("b")!.x);
		expect(
			positions.get("operation")!.x - positions.get("a")!.x - positions.get("a")!.width,
		).toBe(320);
		expect(
			positions.get("b")!.x -
				positions.get("operation")!.x -
				positions.get("operation")!.width,
		).toBe(320);
	});

	it("terminates for cycles, disconnected components, duplicate ids and isolated nodes", () => {
		const positions = layoutEditorItemOriginFlow({
			edges: [
				edge("a", "operation", "owner"),
				edge("operation", "a"),
				edge("x", "y", "owner"),
				edge("y", "x"),
			],
			nodes: [
				node("a", "item", true),
				node("operation", "source"),
				node("x"),
				node("y", "source"),
				node("isolated"),
				node("isolated"),
			],
		});

		expect(positions.size).toBe(5);
		expect(
			[
				...positions.values(),
			].every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
		).toBe(true);
	});

	it("stacks mixed-height nodes in one rank without overlap", () => {
		const positions = layoutEditorItemOriginFlow({
			edges: [],
			nodes: [
				node("item"),
				node("source", "source"),
			],
		});
		const item = positions.get("item")!;
		const source = positions.get("source")!;

		expect(item.y + item.height <= source.y || source.y + source.height <= item.y).toBe(true);
		expect(source.y - item.y - item.height).toBe(128);
	});

	it("lays out the complete official graph within the domain-layout budget", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const startedAt = performance.now();
		const positions = layoutEditorItemOriginFlow({
			edges: flow.edges,
			nodes: flow.nodes.map((entry) => ({
				...entry,
				starter: entry.status === "starter",
			})),
		});
		const elapsedMs = performance.now() - startedAt;

		expect(positions.size).toBe(flow.nodes.length);
		expect(
			new Set(
				[
					...positions.values(),
				].map(({ x, y }) => `${x}:${y}`),
			).size,
		).toBe(flow.nodes.length);
		expect(elapsedMs).toBeLessThan(250);
		const winery = readEditorOriginFlowHighlight(flow, positions, {
			id: "item:item:blueprint-winery-t1",
			kind: "node",
		});
		expect(winery.nodeIds).toContain(
			"source:item:blueprint-winery-t1:line:line:blueprint:winery-t1:construct:single-set:guaranteed:drop",
		);
		expect(winery.nodeIds).toContain("item:producer:winery-t1");
		expect(winery.nodeIds.size).toBeLessThan(64);
		expect(winery.edgeIds.size).toBeLessThan(128);
	});
});
