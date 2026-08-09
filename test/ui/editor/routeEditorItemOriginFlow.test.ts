import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type {
	EditorItemOriginFlowLayoutInput,
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { routeEditorItemOriginFlowFx } from "~/ui/item/editor/routeEditorItemOriginFlowFx";

const node = (
	id: string,
	{
		height = 176,
		ports = [],
		width = 420,
	}: {
		readonly height?: number;
		readonly ports?: EditorItemOriginFlowLayoutInput["nodes"][number]["ports"];
		readonly width?: number;
	} = {},
): EditorItemOriginFlowLayoutInput["nodes"][number] => ({
	height,
	id,
	ports,
	type: "simple",
	width,
});

const position = (
	x: number,
	y: number,
	{
		height = 176,
		width = 420,
	}: {
		readonly height?: number;
		readonly width?: number;
	} = {},
): EditorItemOriginFlowLayoutNode => ({
	flowOrder: 0,
	height,
	width,
	x,
	y,
});

const expectOrthogonalRoute = (points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>) => {
	expect(points.length).toBeGreaterThanOrEqual(2);
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1]!;
		const point = points[index]!;
		expect(point.x === previous.x || point.y === previous.y).toBe(true);
	}
};

const readLongestHorizontalSegment = (points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>) => {
	let longest:
		| {
				readonly fromX: number;
				readonly toX: number;
				readonly y: number;
		  }
		| undefined;
	for (let index = 1; index < points.length; index += 1) {
		const from = points[index - 1]!;
		const to = points[index]!;
		if (from.y !== to.y) continue;
		if (
			longest === undefined ||
			Math.abs(to.x - from.x) > Math.abs(longest.toX - longest.fromX)
		)
			longest = {
				fromX: from.x,
				toX: to.x,
				y: from.y,
			};
	}
	return longest;
};

describe("routeEditorItemOriginFlow", () => {
	it("routes exactly between explicit item ports", () => {
		const flow: EditorItemOriginFlowLayoutInput = {
			edges: [
				{
					id: "source->target",
					source: "source",
					sourcePortId: "out",
					target: "target",
					targetPortId: "in",
				},
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
		};
		const positions = new Map([
			[
				"source",
				position(100, 200, {
					height: 260,
				}),
			],
			[
				"target",
				position(1_100, 500, {
					height: 420,
				}),
			],
		]);
		const route = Effect.runSync(routeEditorItemOriginFlowFx(flow, positions)).get(
			"source->target",
		)!;
		const start = route[0]!;
		const end = route.at(-1)!;

		expect(start).toEqual({
			x: 520,
			y: 392,
		});
		expect(end).toEqual({
			x: 1_100,
			y: 592,
		});
		expectOrthogonalRoute(route);
		expect(route[1]!.x - start.x).toBeGreaterThanOrEqual(56);
		expect(route[1]!.x - start.x).toBeLessThan(152);
		expect(route[1]!.x % 96).toBeCloseTo(0, 5);
		expect(end.x - route.at(-2)!.x).toBeGreaterThanOrEqual(56);
		expect(end.x - route.at(-2)!.x).toBeLessThan(152);
		expect(route.at(-2)!.x % 96).toBeCloseTo(0, 5);
	});

	it("bundles nearby forward cables onto one shared trunk", () => {
		const flow: EditorItemOriginFlowLayoutInput = {
			edges: [
				{
					id: "a",
					source: "source-a",
					target: "target-a",
				},
				{
					id: "b",
					source: "source-b",
					target: "target-b",
				},
			],
			nodes: [
				node("source-a"),
				node("source-b"),
				node("target-a"),
				node("target-b"),
			],
		};
		const positions = new Map([
			[
				"source-a",
				position(0, 0),
			],
			[
				"source-b",
				position(0, 40),
			],
			[
				"target-a",
				position(1_000, 160),
			],
			[
				"target-b",
				position(1_000, 176),
			],
		]);
		const routes = Effect.runSync(routeEditorItemOriginFlowFx(flow, positions));
		const trunkA = readLongestHorizontalSegment(routes.get("a")!)!;
		const trunkB = readLongestHorizontalSegment(routes.get("b")!)!;

		expect(trunkA).toEqual(trunkB);
		expect(trunkA.y % 96).toBeCloseTo(0, 5);
	});

	it("keeps backward cables outside both endpoint cards", () => {
		const flow: EditorItemOriginFlowLayoutInput = {
			edges: [
				{
					id: "back",
					source: "right",
					target: "left",
				},
			],
			nodes: [
				node("right"),
				node("left"),
			],
		};
		const positions = new Map([
			[
				"right",
				position(1_000, 300),
			],
			[
				"left",
				position(0, 260),
			],
		]);
		const route = Effect.runSync(routeEditorItemOriginFlowFx(flow, positions)).get("back")!;
		const middleY = route[2]!.y;
		const top = Math.min(260, 300);
		const bottom = Math.max(260 + 176, 300 + 176);

		expectOrthogonalRoute(route);
		expect(middleY <= top - 84 || middleY >= bottom + 84).toBe(true);
	});
});
