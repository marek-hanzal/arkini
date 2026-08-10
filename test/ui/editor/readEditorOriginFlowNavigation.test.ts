import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import type { EditorOriginFlowDirection } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowNavigationFx } from "~/ui/item/editor/readEditorOriginFlowNavigationFx";

const flow = {
	edges: [
		{
			id: "root-a",
			source: "root",
			target: "a",
		},
		{
			id: "a-straight",
			source: "a",
			target: "straight",
		},
		{
			id: "a-side",
			source: "a",
			target: "side",
		},
		{
			id: "side-end",
			source: "side",
			target: "end",
		},
		{
			id: "end-a",
			source: "end",
			target: "a",
		},
	],
	nodes: [
		{
			id: "root",
		},
		{
			id: "a",
		},
		{
			id: "straight",
		},
		{
			id: "side",
		},
		{
			id: "end",
		},
	],
} as unknown as EditorItemOriginFlow;

const position = (flowOrder: number, x: number, y: number) => ({
	flowOrder,
	height: 40,
	width: 40,
	x,
	y,
});

const positions = new Map([
	[
		"root",
		position(0, 0, 0),
	],
	[
		"a",
		position(1, 100, 0),
	],
	[
		"straight",
		position(2, 200, 0),
	],
	[
		"side",
		position(3, 100, 100),
	],
	[
		"end",
		position(4, 200, 100),
	],
]);

const runNavigation = (
	flowInput: EditorItemOriginFlow,
	positionInput: typeof positions,
	startNodeId: string,
	direction: EditorOriginFlowDirection = "income",
	allowedEdgeIds?: ReadonlySet<string>,
) =>
	Effect.runSync(
		readEditorOriginFlowNavigationFx(
			flowInput,
			positionInput,
			startNodeId,
			direction,
			allowedEdgeIds,
		),
	);

describe("readEditorOriginFlowNavigation", () => {
	it("walks backward through Income prerequisites", () => {
		expect(runNavigation(flow, positions, "end")).toEqual([
			"end",
			"side",
			"a",
			"root",
		]);
	});

	it("walks forward through Outcome products", () => {
		expect(runNavigation(flow, positions, "root", "outcome")).toEqual([
			"root",
			"a",
			"straight",
			"side",
			"end",
		]);
	});

	it("prefers the nearest upstream flow layer when Income branches equally", () => {
		const branchedFlow = {
			edges: [
				{
					id: "near-target",
					source: "near",
					target: "target",
				},
				{
					id: "far-target",
					source: "far",
					target: "target",
				},
			],
			nodes: [
				{
					id: "target",
				},
				{
					id: "near",
				},
				{
					id: "far",
				},
			],
		} as unknown as EditorItemOriginFlow;
		const branchedPositions = new Map([
			[
				"target",
				position(5, 200, 0),
			],
			[
				"near",
				position(4, 100, -50),
			],
			[
				"far",
				position(1, 100, 50),
			],
		]);

		expect(runNavigation(branchedFlow, branchedPositions, "target")).toEqual([
			"target",
			"near",
			"far",
		]);
	});

	it("uses geometry to prefer the straighter upstream continuation", () => {
		const branchedFlow = {
			edges: [
				{
					id: "root-a",
					source: "root",
					target: "a",
				},
				{
					id: "left-root",
					source: "left",
					target: "root",
				},
				{
					id: "up-root",
					source: "up",
					target: "root",
				},
			],
			nodes: [
				{
					id: "a",
				},
				{
					id: "root",
				},
				{
					id: "left",
				},
				{
					id: "up",
				},
			],
		} as unknown as EditorItemOriginFlow;
		const branchedPositions = new Map([
			[
				"a",
				position(3, 300, 0),
			],
			[
				"root",
				position(2, 200, 0),
			],
			[
				"left",
				position(1, 100, 0),
			],
			[
				"up",
				position(1, 200, -100),
			],
		]);

		expect(runNavigation(branchedFlow, branchedPositions, "a")).toEqual([
			"a",
			"root",
			"left",
			"up",
		]);
	});

	it("ignores feedback edges and input ordering", () => {
		const shuffled = {
			...flow,
			edges: [
				...flow.edges,
			].reverse(),
			nodes: [
				...flow.nodes,
			].reverse(),
		} as unknown as EditorItemOriginFlow;

		expect(runNavigation(shuffled, positions, "end")).toEqual(
			runNavigation(flow, positions, "end"),
		);
	});

	it("stays inside the highlighted Income proof when allowed edges are supplied", () => {
		expect(
			runNavigation(
				flow,
				positions,
				"end",
				"income",
				new Set([
					"side-end",
					"a-side",
				]),
			),
		).toEqual([
			"end",
			"side",
			"a",
		]);
	});
});
