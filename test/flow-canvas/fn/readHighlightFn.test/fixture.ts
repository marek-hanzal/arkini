import type {
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
	EditorItemOriginOperation,
} from "~/flow/type/EditorItemOriginFlow";

const operation = (
	id: string,
	inputs: ReadonlyArray<string>,
	outputs: ReadonlyArray<string>,
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
	operations: ReadonlyArray<EditorItemOriginOperation> = [],
): EditorItemOriginItemNode => ({
	id: `item:${itemId}`,
	itemId,
	operations,
	resourceIds: [
		"missing",
	],
	starterScopes: [],
	title: itemId,
	type: "simple",
});

export const producerFlow: EditorItemOriginFlow = {
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
		item("target"),
		item("forge", [
			operation(
				"op:forge",
				[
					"tool",
					"water",
				],
				[
					"target",
				],
			),
		]),
		item("tool"),
		item("water"),
		item("loop", [
			operation(
				"op:loop",
				[],
				[
					"target",
				],
			),
		]),
	],
};

export const cyclicFlow: EditorItemOriginFlow = {
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
		item("target"),
		item("a", [
			operation(
				"op:a",
				[
					"target",
				],
				[
					"target",
				],
			),
		]),
	],
};
