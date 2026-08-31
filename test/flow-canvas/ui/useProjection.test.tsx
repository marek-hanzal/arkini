// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemOriginFlow, ItemOriginItemNode } from "~/flow/type/ItemOriginFlow";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";
import { useProjection } from "~/flow-canvas/ui/useProjection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const itemNode = (itemId: string): ItemOriginItemNode => ({
	id: `item:${itemId}`,
	itemId,
	operations: [],
	resourceIds: [
		itemId,
	],
	starterScopes: [],
	title: itemId,
	type: "simple",
});
const position = (flowOrder: number, x: number, y: number): LayoutNode => ({
	flowOrder,
	height: 10,
	width: 10,
	x,
	y,
});
const point = (x: number, y: number): LayoutPoint => ({
	x,
	y,
});
const flow: ItemOriginFlow = {
	edges: [
		{
			id: "ore-smelter-a",
			operationId: "smelter-a",
			role: "input",
			source: "item:ore",
			target: "item:smelter-a",
		},
		{
			id: "ore-smelter-b",
			operationId: "smelter-b",
			role: "input",
			source: "item:ore",
			target: "item:smelter-b",
		},
	],
	nodes: [
		itemNode("ore"),
		itemNode("smelter-a"),
		itemNode("smelter-b"),
	],
};
const positions = new Map<string, LayoutNode>([
	[
		"item:ore",
		position(0, 0, 0),
	],
	[
		"item:smelter-a",
		position(1, 100, 0),
	],
	[
		"item:smelter-b",
		position(2, 100, 100),
	],
]);
const backbone: ReadonlyArray<LayoutPoint> = [
	point(0, 0),
	point(96, 0),
	point(96, 96),
	point(192, 96),
	point(192, 0),
	point(288, 0),
];
const backbones = new Map([
	[
		"ore-smelter-a",
		backbone,
	],
	[
		"ore-smelter-b",
		backbone,
	],
]);
const selection = {
	id: "item:ore",
	kind: "node",
} as const;

const renderProjection = async () => {
	const state: {
		current?: ReturnType<typeof useProjection>;
	} = {};
	const Probe = () => {
		state.current = useProjection({
			backbones,
			direction: "input",
			flow,
			positions,
			selection,
		});
		return null;
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(createElement(Probe)));
	return state;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("useProjection", () => {
	it("routes highlighted edge bundles through the metro projection boundary", async () => {
		const state = await renderProjection();

		expect([
			...state.current!.highlightedEdgeColors.keys(),
		]).toEqual([
			"ore-smelter-a",
			"ore-smelter-b",
		]);
		expect(state.current?.metroBackbones.get("ore-smelter-a")).toEqual([
			backbone[0],
			point(91, 0),
			point(91, 91),
			point(187, 91),
			point(187, 0),
			backbone[5],
		]);
		expect(state.current?.metroBackbones.get("ore-smelter-b")).toEqual([
			backbone[0],
			point(101, 0),
			point(101, 101),
			point(197, 101),
			point(197, 0),
			backbone[5],
		]);
	});

	it("keeps relation and root traversal identities stable when visible depth changes", async () => {
		const state = await renderProjection();
		const inputNodeIds = state.current?.inputNavigationNodeIds;
		const outputNodeIds = state.current?.outputNavigationNodeIds;
		const rootNodeIds = state.current?.rootNavigationNodeIds;
		const navigationNodeIds = state.current?.navigationNodeIds;

		await act(async () =>
			state.current?.setHighlightDepthFn({
				direction: "input",
				limit: 0,
				nodeId: selection.id,
			}),
		);

		expect(state.current?.navigationNodeIds).not.toBe(navigationNodeIds);
		expect(state.current?.inputNavigationNodeIds).toBe(inputNodeIds);
		expect(state.current?.outputNavigationNodeIds).toBe(outputNodeIds);
		expect(state.current?.rootNavigationNodeIds).toBe(rootNodeIds);
	});
});
