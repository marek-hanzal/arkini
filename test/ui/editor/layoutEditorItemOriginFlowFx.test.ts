import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type {
	EditorItemOriginFlowLayoutInput,
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { layoutEditorItemOriginFlowFx } from "~/ui/item/editor/layoutEditorItemOriginFlowFx";

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

const expectFinitePoint = ({ x, y }: EditorItemOriginFlowLayoutPoint) => {
	expect(Number.isFinite(x)).toBe(true);
	expect(Number.isFinite(y)).toBe(true);
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

});
