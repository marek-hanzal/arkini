import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";

const flow = {
	edges: [
		{
			id: "a-b",
			source: "a",
			target: "b",
		},
		{
			id: "b-c",
			source: "b",
			target: "c",
		},
		{
			id: "b-d",
			source: "b",
			target: "d",
		},
		{
			id: "d-b",
			source: "d",
			target: "b",
		},
		{
			id: "x-b",
			source: "x",
			target: "b",
		},
	],
	nodes: [
		{
			id: "a",
		},
		{
			id: "b",
		},
		{
			id: "c",
		},
		{
			id: "d",
		},
		{
			id: "x",
		},
	],
} as unknown as EditorItemOriginFlow;

describe("readEditorOriginFlowHighlight", () => {
	it("includes every downstream branch from a selected node and terminates at cycles", () => {
		const highlight = readEditorOriginFlowHighlight(flow, {
			id: "b",
			kind: "node",
		});

		expect([
			...highlight.nodeIds,
		]).toEqual([
			"b",
			"c",
			"d",
		]);
		expect([
			...highlight.edgeIds,
		]).toEqual([
			"b-c",
			"b-d",
			"d-b",
		]);
	});

	it("starts an edge selection at that connection without including sibling inputs", () => {
		const highlight = readEditorOriginFlowHighlight(flow, {
			id: "a-b",
			kind: "edge",
		});

		expect(highlight.nodeIds).toEqual(
			new Set([
				"a",
				"b",
				"c",
				"d",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"a-b",
				"b-c",
				"b-d",
				"d-b",
			]),
		);
	});

	it("keeps a selected cycle connection before continuing from its target", () => {
		const highlight = readEditorOriginFlowHighlight(flow, {
			id: "d-b",
			kind: "edge",
		});

		expect(highlight.nodeIds).toEqual(
			new Set([
				"d",
				"b",
				"c",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"d-b",
				"b-c",
				"b-d",
			]),
		);
	});

	it("returns the whole graph for a graph selection", () => {
		const highlight = readEditorOriginFlowHighlight(flow, {
			kind: "graph",
		});

		expect(highlight.nodeIds).toEqual(
			new Set([
				"a",
				"b",
				"c",
				"d",
				"x",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"a-b",
				"b-c",
				"b-d",
				"d-b",
				"x-b",
			]),
		);
	});

	it("returns an empty highlight for a stale selection", () => {
		expect(
			readEditorOriginFlowHighlight(flow, {
				id: "missing",
				kind: "node",
			}),
		).toEqual({
			edgeIds: new Set(),
			nodeIds: new Set(),
		});
	});
});
