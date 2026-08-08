import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlow,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import {
	readEditorOriginFlowNavigation,
	readEditorOriginFlowProducerNavigation,
} from "~/ui/item/editor/readEditorOriginFlowNavigation";
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
		placement: "drop",
		selectionKind: "guaranteed",
		weightedSet: false,
	})),
	status: "reachable",
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
	depth: 0,
	id: `item:${itemId}`,
	itemId,
	kind: "item",
	operations,
	resourceIds: [
		"missing",
	],
	starterScopes: starter
		? [
				"Board",
			]
		: [],
	status: starter ? "starter" : "reachable",
	title: itemId,
	type: "simple",
});

const incomeFlow: EditorItemOriginFlow = {
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
	obtainable: true,
};

const positions = new Map(
	incomeFlow.nodes.map(
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

describe("readEditorOriginFlowHighlight", () => {
	it("includes every producer branch with its mandatory prerequisites", () => {
		const highlight = readEditorOriginFlowHighlight(incomeFlow, positions, {
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
		expect(highlight.branchIndexByEdgeId).toEqual(
			new Map([
				[
					"forge-target",
					0,
				],
				[
					"tool-forge",
					0,
				],
				[
					"water-forge",
					0,
				],
				[
					"loop-target",
					1,
				],
			]),
		);

		const producerNodeIds = readEditorOriginFlowProducerNavigation(incomeFlow, "item:target");
		const navigationNodeIds = readEditorOriginFlowNavigation(
			incomeFlow,
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

	it("stops tracing when the selected item is already a starter", () => {
		const highlight = readEditorOriginFlowHighlight(incomeFlow, positions, {
			id: "item:tool",
			kind: "node",
		});
		expect(highlight).toEqual({
			branchIndexByEdgeId: new Map(),
			edgeIds: new Set(),
			nodeIds: new Set([
				"item:tool",
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
			obtainable: true,
		};
		const layout = new Map(
			flow.nodes.map(
				(node, index) =>
					[
						node.id,
						{
							flowOrder: index,
						},
					] as const,
			),
		);

		const highlight = readEditorOriginFlowHighlight(flow, layout, {
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
		const highlight = readEditorOriginFlowHighlight(incomeFlow, positions, {
			id: "tool-forge",
			kind: "edge",
		});
		expect(highlight).toEqual({
			branchIndexByEdgeId: new Map(),
			edgeIds: new Set([
				"tool-forge",
			]),
			nodeIds: new Set([
				"item:forge",
				"item:tool",
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
			obtainable: false,
		};
		const layout = new Map(
			flow.nodes.map(
				(node, index) =>
					[
						node.id,
						{
							flowOrder: index,
						},
					] as const,
			),
		);
		const highlight = readEditorOriginFlowHighlight(flow, layout, {
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

	it("keeps every official Coin producer in the highlighted Income navigation", async () => {
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
		const highlight = readEditorOriginFlowHighlight(flow, layout, {
			id: coinNodeId,
			kind: "node",
		});
		const directCoinOutputEdges = flow.edges.filter(
			(edge) => edge.role === "output" && edge.target === coinNodeId,
		);
		const directOperationIds = new Set(
			directCoinOutputEdges.map(({ operationId }) => operationId),
		);
		const directBranchIndexes = new Set(
			directCoinOutputEdges.map(({ id }) => highlight.branchIndexByEdgeId.get(id)),
		);
		expect(directBranchIndexes.has(undefined)).toBe(false);
		expect(directBranchIndexes.size).toBe(directOperationIds.size);

		const producerNodeIds = readEditorOriginFlowProducerNavigation(flow, coinNodeId);
		const navigationNodeIds = readEditorOriginFlowNavigation(
			flow,
			layout,
			coinNodeId,
			highlight.edgeIds,
		);

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
			readEditorOriginFlowHighlight(incomeFlow, positions, {
				id: "missing",
				kind: "node",
			}),
		).toEqual({
			branchIndexByEdgeId: new Map(),
			edgeIds: new Set(),
			nodeIds: new Set(),
		});
	});
});
