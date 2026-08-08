import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowNavigation } from "~/ui/item/editor/readEditorOriginFlowNavigation";

const flow = {
	edges: [
		{
			id: "root-a",
			source: "root",
			target: "a",
		},
		{
			id: "a-side",
			source: "a",
			target: "side",
		},
		{
			id: "a-straight",
			source: "a",
			target: "straight",
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

describe("readEditorOriginFlowNavigation", () => {
	it("walks one deterministic branch at a time and prefers the straight continuation", () => {
		expect(readEditorOriginFlowNavigation(flow, positions, "root")).toEqual([
			"root",
			"a",
			"straight",
			"side",
			"end",
		]);
	});

	it("walks backward through prerequisites in Income mode", () => {
		expect(readEditorOriginFlowNavigation(flow, positions, "end", "income")).toEqual([
			"end",
			"side",
			"a",
			"root",
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

		expect(
			readEditorOriginFlowNavigation(branchedFlow, branchedPositions, "target", "income"),
		).toEqual([
			"target",
			"near",
			"far",
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
		};

		expect(readEditorOriginFlowNavigation(shuffled, positions, "root")).toEqual(
			readEditorOriginFlowNavigation(flow, positions, "root"),
		);
	});
	it("stays inside an explicitly selected branch", () => {
		expect(
			readEditorOriginFlowNavigation(
				flow,
				positions,
				"root",
				"outcome",
				new Set([
					"root-a",
					"a-side",
					"side-end",
				]),
			),
		).toEqual([
			"root",
			"a",
			"side",
			"end",
		]);
	});
});
