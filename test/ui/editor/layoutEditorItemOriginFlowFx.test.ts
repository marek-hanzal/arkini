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
	layoutEditorItemOriginFlowFx,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const node = (
	id: string,
	type: EditorItemOriginFlowLayoutInput["nodes"][number]["type"] = "simple",
) => ({
	id,
	type,
});

const edge = (source: string, target: string, id = `${source}->${target}`) => ({
	id,
	source,
	target,
});

const readTopology = (flow: EditorItemOriginFlow): EditorItemOriginFlowLayoutInput => ({
	edges: flow.edges.map(({ id, source, sourcePortId, target, targetPortId }) => ({
		id,
		source,
		sourcePortId,
		target,
		targetPortId,
	})),
	nodes: flow.nodes.map(({ id, type }) => ({
		id,
		type,
	})),
});

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

const circleOverlap = (
	left: EditorItemOriginFlowLayoutNode,
	right: EditorItemOriginFlowLayoutNode,
) => {
	const distance = Math.hypot(
		left.x + left.width / 2 - (right.x + right.width / 2),
		left.y + left.height / 2 - (right.y + right.height / 2),
	);
	return (left.width + right.width) / 2 - distance;
};

describe("layoutEditorItemOriginFlowFx", () => {
	it("keeps deterministic weighted positions independent of input order", () => {
		const topology: EditorItemOriginFlowLayoutInput = {
			edges: [
				edge("a", "b"),
				edge("b", "c"),
			],
			nodes: [
				node("c"),
				node("a"),
				node("b", "producer"),
			],
		};
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(topology));
		const shuffled = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					...topology.edges,
				].reverse(),
				nodes: [
					...topology.nodes,
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
		expect(layout.positions.get("a")?.flowOrder).toBeLessThan(
			layout.positions.get("c")?.flowOrder ?? -1,
		);
	});

	it("keeps cycles and disconnected components finite", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					edge("a", "b"),
					edge("b", "a", "b->a"),
					edge("c", "d"),
				],
				nodes: [
					node("a"),
					node("b"),
					node("c"),
					node("d"),
				],
			}),
		);
		expect(layout.positions.size).toBe(4);
		for (const position of layout.positions.values()) {
			expect(Number.isFinite(position.x)).toBe(true);
			expect(Number.isFinite(position.y)).toBe(true);
			expect(position.width).toBeGreaterThan(0);
			expect(position.width).toBe(position.height);
		}
	});

	it("uses topology and port pressure to give hubs more map space", () => {
		const layout = Effect.runSync(
			layoutEditorItemOriginFlowFx({
				edges: [
					{
						...edge("hub", "a"),
						sourcePortId: "out:a",
					},
					{
						...edge("hub", "b"),
						sourcePortId: "out:b",
					},
					{
						...edge("hub", "c"),
						sourcePortId: "out:c",
					},
					{
						...edge("a", "leaf"),
					},
				],
				nodes: [
					node("hub"),
					node("a"),
					node("b"),
					node("c"),
					node("leaf"),
				],
			}),
		);
		const hub = layout.positions.get("hub")!;
		const leaf = layout.positions.get("leaf")!;
		expect(hub.degree).toBe(3);
		expect(hub.portCount).toBe(3);
		expect(hub.importance).toBeGreaterThan(leaf.importance);
		expect(hub.width).toBeGreaterThan(leaf.width);
	});

	it("lays out the official map compactly with no node overlap", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const startedAt = performance.now();
		const layout = Effect.runSync(layoutEditorItemOriginFlowFx(readTopology(flow)));
		const elapsed = performance.now() - startedAt;
		const bounds = readBounds(layout);

		expect(layout.positions.size).toBe(flow.nodes.length);
		expect(layout.backbones.size).toBe(flow.edges.length);
		expect(elapsed).toBeLessThan(6000);
		expect(bounds.width).toBeLessThan(7000);
		expect(bounds.height).toBeLessThan(7000);
		expect(bounds.width / bounds.height).toBeGreaterThan(0.65);
		expect(bounds.width / bounds.height).toBeLessThan(1.55);

		const positions = [
			...layout.positions.values(),
		];
		for (let left = 0; left < positions.length; left += 1)
			for (let right = left + 1; right < positions.length; right += 1)
				expect(circleOverlap(positions[left]!, positions[right]!)).toBeLessThan(0.2);

		const positionByTitle = (title: string) => {
			const node = flow.nodes.find((candidate) => candidate.title === title);
			if (node === undefined) throw new Error(`Missing official item ${title}.`);
			const position = layout.positions.get(node.id);
			if (position === undefined) throw new Error(`Missing layout for ${title}.`);
			return position;
		};
		const library = positionByTitle("Library IV");
		const water = positionByTitle("Water");
		const academy = positionByTitle("Academy");
		expect(library.degree).toBeGreaterThan(water.degree);
		expect(library.width).toBeGreaterThan(water.width);
		expect(water.degree).toBeGreaterThan(40);
		expect(water.width).toBeGreaterThan(300);
		expect(academy.portCount).toBeGreaterThan(40);
		expect(academy.width).toBeGreaterThan(350);

		for (const edge of flow.edges) {
			const backbone = layout.backbones.get(edge.id);
			expect(backbone).toHaveLength(2);
			for (const point of backbone ?? []) {
				expect(Number.isFinite(point.x)).toBe(true);
				expect(Number.isFinite(point.y)).toBe(true);
			}
		}
	}, 10_000);
});
