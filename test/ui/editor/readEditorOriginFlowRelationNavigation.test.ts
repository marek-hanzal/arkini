import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowRelationNavigation } from "~/ui/item/editor/readEditorOriginFlowRelationNavigation";

const relationFlow = {
	edges: [
		{
			id: "z-output",
			operationId: "line:z",
			role: "output",
			source: "item:z",
			target: "item:log",
		},
		{
			id: "a-output-1",
			operationId: "line:a:1",
			role: "output",
			source: "item:a",
			target: "item:log",
		},
		{
			id: "a-output-2",
			operationId: "line:a:2",
			role: "output",
			source: "item:a",
			target: "item:log",
		},
		{
			id: "log-input-a",
			operationId: "line:a:1",
			role: "input",
			source: "item:log",
			target: "item:a",
		},
		{
			id: "log-input-z",
			operationId: "line:z",
			role: "input",
			source: "item:log",
			target: "item:z",
		},
		{
			id: "log-input-z-2",
			operationId: "line:z:2",
			role: "input",
			source: "item:log",
			target: "item:z",
		},
	],
	nodes: [
		{
			id: "item:log",
			itemId: "item:log",
			title: "Log",
		},
		{
			id: "item:z",
			itemId: "producer:z",
			title: "Zeta Mill",
		},
		{
			id: "item:a",
			itemId: "producer:a",
			title: "Alpha Mill",
		},
	],
} as unknown as EditorItemOriginFlow;

const runNavigation = (
	flow: EditorItemOriginFlow,
	selectedRole: "input" | "output",
	selectedNodeId = "item:log",
) =>
	readEditorOriginFlowRelationNavigation({
		flow,
		selectedNodeId,
		selectedRole,
	});

describe("readEditorOriginFlowRelationNavigation", () => {
	it("finds each node that uses the selected item as input once in stable order", () => {
		const expected = [
			"item:a",
			"item:z",
		];
		expect(runNavigation(relationFlow, "input")).toEqual(expected);
		expect(
			runNavigation(
				{
					...relationFlow,
					edges: [
						...relationFlow.edges,
					].reverse(),
					nodes: [
						...relationFlow.nodes,
					].reverse(),
				},
				"input",
			),
		).toEqual(expected);
	});

	it("finds each node that outputs the selected item once in stable order", () => {
		expect(runNavigation(relationFlow, "output")).toEqual([
			"item:a",
			"item:z",
		]);
	});

	it("ignores self relations and missing nodes", () => {
		const flow = {
			...relationFlow,
			edges: [
				{
					id: "self-input",
					operationId: "line:self-input",
					role: "input",
					source: "item:log",
					target: "item:log",
				},
				{
					id: "self-output",
					operationId: "line:self-output",
					role: "output",
					source: "item:log",
					target: "item:log",
				},
				{
					id: "missing-input",
					operationId: "line:missing-input",
					role: "input",
					source: "item:log",
					target: "item:missing",
				},
				{
					id: "missing-output",
					operationId: "line:missing-output",
					role: "output",
					source: "item:missing",
					target: "item:log",
				},
			],
		} as unknown as EditorItemOriginFlow;

		expect(runNavigation(flow, "input")).toEqual([]);
		expect(runNavigation(flow, "output")).toEqual([]);
	});
});
