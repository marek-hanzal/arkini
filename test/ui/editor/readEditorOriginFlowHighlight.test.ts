import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	type EditorItemOriginFlow,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import { readEditorItemOriginFlowFx } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import {
	type EditorOriginFlowDirection,
	type EditorOriginFlowSelection,
	readEditorOriginFlowHighlightFx,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowNavigationFx } from "~/ui/item/editor/readEditorOriginFlowNavigationFx";
import { readEditorOriginFlowRelationNavigationFx } from "~/ui/item/editor/readEditorOriginFlowRelationNavigationFx";
import { readEditorOriginFlowRootNavigationFx } from "~/ui/item/editor/readEditorOriginFlowRootNavigationFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const operation = (
	id: string,
	{
		inputs = [],
		outputs = [],
	}: {
		readonly inputs?: ReadonlyArray<string>;
		readonly outputs?: ReadonlyArray<string>;
	} = {},
): EditorItemOriginOperation => ({
	id,
	inputs: inputs.map((itemId) => ({
		id: `${id}:input:${itemId}`,
		itemId,
		label: itemId,
	})),
	kind: "line",
	label: id,
	outputs: outputs.map((itemId, index) => ({
		id: `${id}:output:${index}:${itemId}`,
		itemId,
		label: itemId,
	})),
});

const item = (
	itemId: string,
	{
		acquisitionSourceId,
		operations = [],
		starter = false,
	}: {
		readonly acquisitionSourceId?: string;
		readonly operations?: ReadonlyArray<EditorItemOriginOperation>;
		readonly starter?: boolean;
	} = {},
): EditorItemOriginItemNode => ({
	acquisitionSourceId,
	id: `item:${itemId}`,
	itemId,
	operations,
	resourceIds: [
		"missing",
	],
	starterScopes: starter
		? [
				"Board",
			]
		: [],
	title: itemId,
	type: "simple",
});

const outputFlow: EditorItemOriginFlow = {
	edges: [
		{
			id: "tool-forge",
			operationId: "op:forge",
			role: "input",
			source: "item:tool",
			target: "item:forge",
			targetPortId: "op:forge:input:tool",
		},
		{
			id: "water-forge",
			operationId: "op:forge",
			role: "input",
			source: "item:water",
			target: "item:forge",
			targetPortId: "op:forge:input:water",
		},
		{
			id: "forge-target",
			operationId: "op:forge",
			role: "output",
			source: "item:forge",
			sourcePortId: "op:forge:output:0:target",
			target: "item:target",
		},
		{
			id: "loop-target",
			operationId: "op:loop",
			role: "output",
			source: "item:loop",
			target: "item:target",
		},
	],
	nodes: [
		item("target", {
			acquisitionSourceId: "op:forge",
		}),
		item("forge", {
			operations: [
				operation("op:forge", {
					inputs: [
						"tool",
						"water",
					],
					outputs: [
						"target",
					],
				}),
			],
			starter: true,
		}),
		item("tool", {
			starter: true,
		}),
		item("water", {
			starter: true,
		}),
		item("loop", {
			operations: [
				operation("op:loop", {
					outputs: [
						"target",
					],
				}),
			],
		}),
	],
};

const positions = new Map(
	outputFlow.nodes.map(
		(node, index) =>
			[
				node.id,
				{
					flowOrder: index,
					height: 40,
					width: 40,
					x: index * 100,
					y: 0,
				},
			] as const,
	),
);

const runHighlight = (
	flow: EditorItemOriginFlow,
	selection: EditorOriginFlowSelection,
	direction: EditorOriginFlowDirection = "output",
) => Effect.runSync(readEditorOriginFlowHighlightFx(flow, selection, direction));

const runRelationNavigation = (
	input: Parameters<typeof readEditorOriginFlowRelationNavigationFx>[0],
) => Effect.runSync(readEditorOriginFlowRelationNavigationFx(input));

const runNavigation = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<
		string,
		{
			readonly flowOrder: number;
			readonly height: number;
			readonly width: number;
			readonly x: number;
			readonly y: number;
		}
	>,
	startNodeId: string,
	allowedEdgeIds?: ReadonlySet<string>,
) =>
	Effect.runSync(
		readEditorOriginFlowNavigationFx(flow, positions, startNodeId, "output", allowedEdgeIds),
	);

describe("readEditorOriginFlowHighlight", () => {
	it("includes every producer branch with its mandatory prerequisites", () => {
		const highlight = runHighlight(outputFlow, {
			id: "item:target",
			kind: "node",
		});

		expect(highlight.nodeIds).toEqual(
			new Set([
				"item:target",
				"item:forge",
				"item:tool",
				"item:water",
				"item:loop",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"forge-target",
				"tool-forge",
				"water-forge",
				"loop-target",
			]),
		);
		expect(highlight.nodeLevels).toEqual(
			new Map([
				[
					"item:target",
					0,
				],
				[
					"item:forge",
					1,
				],
				[
					"item:loop",
					1,
				],
				[
					"item:tool",
					2,
				],
				[
					"item:water",
					2,
				],
			]),
		);
		expect(highlight.edgeLevels).toEqual(
			new Map([
				[
					"tool-forge",
					2,
				],
				[
					"water-forge",
					2,
				],
				[
					"forge-target",
					1,
				],
				[
					"loop-target",
					1,
				],
			]),
		);

		const producerNodeIds = runRelationNavigation({
			flow: outputFlow,
			selectedNodeId: "item:target",
			selectedRole: "output",
		});
		const navigationNodeIds = runNavigation(
			outputFlow,
			positions,
			"item:target",
			highlight.edgeIds,
		);
		expect(producerNodeIds).toEqual([
			"item:forge",
			"item:loop",
		]);
		for (const producerNodeId of producerNodeIds) {
			expect(highlight.nodeIds.has(producerNodeId)).toBe(true);
			expect(navigationNodeIds).toContain(producerNodeId);
		}
	});

	it("traces Input forward without pulling unrelated co-input branches", () => {
		const highlight = runHighlight(
			outputFlow,
			{
				id: "item:tool",
				kind: "node",
			},
			"input",
		);

		expect(highlight.nodeIds).toEqual(
			new Set([
				"item:tool",
				"item:forge",
				"item:target",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"tool-forge",
				"forge-target",
			]),
		);
		expect(highlight.nodeLevels).toEqual(
			new Map([
				[
					"item:tool",
					0,
				],
				[
					"item:forge",
					1,
				],
				[
					"item:target",
					2,
				],
			]),
		);
	});

	it("finds every terminal/root node in the selected proof, farthest first", () => {
		const highlight = runHighlight(outputFlow, {
			id: "item:target",
			kind: "node",
		});
		const roots = Effect.runSync(readEditorOriginFlowRootNavigationFx(outputFlow, highlight));

		expect(roots).toEqual([
			"item:tool",
			"item:water",
			"item:loop",
		]);
	});

	it("includes shared upstream edges once when multiple producer branches use them", () => {
		const sharedFlow: EditorItemOriginFlow = {
			edges: [
				{
					id: "common-a",
					operationId: "op:a",
					role: "input",
					source: "item:common",
					target: "item:a",
					targetPortId: "op:a:input:common",
				},
				{
					id: "a-target",
					operationId: "op:a",
					role: "output",
					source: "item:a",
					sourcePortId: "op:a:output:0:target",
					target: "item:target",
				},
				{
					id: "common-b",
					operationId: "op:b",
					role: "input",
					source: "item:common",
					target: "item:b",
					targetPortId: "op:b:input:common",
				},
				{
					id: "b-target",
					operationId: "op:b",
					role: "output",
					source: "item:b",
					sourcePortId: "op:b:output:0:target",
					target: "item:target",
				},
				{
					id: "seed-common-owner",
					operationId: "op:common",
					role: "input",
					source: "item:seed",
					target: "item:common-owner",
					targetPortId: "op:common:input:seed",
				},
				{
					id: "common-owner-common",
					operationId: "op:common",
					role: "output",
					source: "item:common-owner",
					sourcePortId: "op:common:output:0:common",
					target: "item:common",
				},
			],
			nodes: [
				item("target"),
				item("a", {
					operations: [
						operation("op:a", {
							inputs: [
								"common",
							],
							outputs: [
								"target",
							],
						}),
					],
					starter: true,
				}),
				item("b", {
					operations: [
						operation("op:b", {
							inputs: [
								"common",
							],
							outputs: [
								"target",
							],
						}),
					],
					starter: true,
				}),
				item("common"),
				item("common-owner", {
					operations: [
						operation("op:common", {
							inputs: [
								"seed",
							],
							outputs: [
								"common",
							],
						}),
					],
					starter: true,
				}),
				item("seed", {
					starter: true,
				}),
			],
		};

		const highlight = runHighlight(sharedFlow, {
			id: "item:target",
			kind: "node",
		});

		expect(highlight.edgeIds).toEqual(
			new Set([
				"a-target",
				"b-target",
				"common-a",
				"common-b",
				"common-owner-common",
				"seed-common-owner",
			]),
		);
	});

	it("stops tracing when the selected item is already a starter", () => {
		const highlight = runHighlight(outputFlow, {
			id: "item:tool",
			kind: "node",
		});
		expect(highlight).toEqual({
			edgeIds: new Set(),
			edgeLevels: new Map(),
			nodeIds: new Set([
				"item:tool",
			]),
			nodeLevels: new Map([
				[
					"item:tool",
					0,
				],
			]),
		});
	});

	it("recurses through upstream acquisition operations", () => {
		const flow: EditorItemOriginFlow = {
			edges: [
				{
					id: "ore-tool",
					operationId: "op:tool",
					role: "input",
					source: "item:ore",
					target: "item:smith",
				},
				{
					id: "smith-tool",
					operationId: "op:tool",
					role: "output",
					source: "item:smith",
					target: "item:tool",
				},
				{
					id: "tool-target",
					operationId: "op:target",
					role: "input",
					source: "item:tool",
					target: "item:bench",
				},
				{
					id: "bench-target",
					operationId: "op:target",
					role: "output",
					source: "item:bench",
					target: "item:target",
				},
			],
			nodes: [
				item("target", {
					acquisitionSourceId: "op:target",
				}),
				item("bench", {
					operations: [
						operation("op:target", {
							inputs: [
								"tool",
							],
							outputs: [
								"target",
							],
						}),
					],
					starter: true,
				}),
				item("tool", {
					acquisitionSourceId: "op:tool",
				}),
				item("smith", {
					operations: [
						operation("op:tool", {
							inputs: [
								"ore",
							],
							outputs: [
								"tool",
							],
						}),
					],
					starter: true,
				}),
				item("ore", {
					starter: true,
				}),
			],
		};

		const highlight = runHighlight(flow, {
			id: "item:target",
			kind: "node",
		});
		expect(highlight.nodeIds).toEqual(
			new Set([
				"item:target",
				"item:bench",
				"item:tool",
				"item:smith",
				"item:ore",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"bench-target",
				"tool-target",
				"smith-tool",
				"ore-tool",
			]),
		);
	});

	it("keeps an explicitly selected connection and traces from its source", () => {
		const highlight = runHighlight(outputFlow, {
			id: "tool-forge",
			kind: "edge",
		});
		expect(highlight).toEqual({
			edgeIds: new Set([
				"tool-forge",
			]),
			edgeLevels: new Map([
				[
					"tool-forge",
					1,
				],
			]),
			nodeIds: new Set([
				"item:tool",
				"item:forge",
			]),
			nodeLevels: new Map([
				[
					"item:tool",
					0,
				],
				[
					"item:forge",
					1,
				],
			]),
		});
	});

	it("terminates a circular acquisition proof", () => {
		const flow: EditorItemOriginFlow = {
			edges: [
				{
					id: "target-a",
					operationId: "op:a",
					role: "input",
					source: "item:target",
					target: "item:a",
				},
				{
					id: "a-target",
					operationId: "op:a",
					role: "output",
					source: "item:a",
					target: "item:target",
				},
			],
			nodes: [
				item("target", {
					acquisitionSourceId: "op:a",
				}),
				item("a", {
					operations: [
						operation("op:a", {
							inputs: [
								"target",
							],
							outputs: [
								"target",
							],
						}),
					],
				}),
			],
		};
		const highlight = runHighlight(flow, {
			id: "item:target",
			kind: "node",
		});

		expect(highlight.nodeIds).toEqual(
			new Set([
				"item:target",
				"item:a",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"a-target",
				"target-a",
			]),
		);
	});

	it("keeps every official Coin producer in the highlighted Output navigation", async () => {
		const config = await readArkiniGameConfigSource();
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const coinNodeId = "item:item:coin";
		const layout = new Map(
			flow.nodes.map(
				(node, index) =>
					[
						node.id,
						{
							flowOrder: index,
							height: 40,
							width: 40,
							x: index * 50,
							y: 0,
						},
					] as const,
			),
		);
		const highlight = runHighlight(flow, {
			id: coinNodeId,
			kind: "node",
		});
		const directProducerIds = new Set(
			flow.edges
				.filter((edge) => edge.role === "output" && edge.target === coinNodeId)
				.map(({ source }) => source),
		);
		const producerNodeIds = runRelationNavigation({
			flow,
			selectedNodeId: coinNodeId,
			selectedRole: "output",
		});
		const navigationNodeIds = runNavigation(flow, layout, coinNodeId, highlight.edgeIds);

		expect(new Set(producerNodeIds)).toEqual(directProducerIds);
		expect(producerNodeIds.length).toBeGreaterThan(5);
		expect(producerNodeIds).toEqual(
			expect.arrayContaining([
				"item:item:chest-t1",
				"item:item:chest-t2",
				"item:item:chest-t3",
				"item:item:chest-t4",
			]),
		);
		for (const producerNodeId of producerNodeIds) {
			expect(highlight.nodeIds.has(producerNodeId)).toBe(true);
			expect(navigationNodeIds).toContain(producerNodeId);
		}
	});

	it("returns an empty highlight for a stale selection", () => {
		expect(
			runHighlight(outputFlow, {
				id: "missing",
				kind: "node",
			}),
		).toEqual({
			edgeIds: new Set(),
			edgeLevels: new Map(),
			nodeIds: new Set(),
			nodeLevels: new Map(),
		});
	});
});
