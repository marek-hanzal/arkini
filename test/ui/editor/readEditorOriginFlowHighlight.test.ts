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

const positions = new Map([
	[
		"a",
		{
			flowOrder: 0,
		},
	],
	[
		"b",
		{
			flowOrder: 1,
		},
	],
	[
		"c",
		{
			flowOrder: 2,
		},
	],
	[
		"d",
		{
			flowOrder: 3,
		},
	],
	[
		"x",
		{
			flowOrder: 0,
		},
	],
]);

describe("readEditorOriginFlowHighlight", () => {
	it("follows only cycle-broken forward branches from a selected node", () => {
		const highlight = readEditorOriginFlowHighlight(flow, positions, {
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
		]);
	});

	it("walks toward prerequisites when Income is selected", () => {
		const highlight = readEditorOriginFlowHighlight(
			flow,
			positions,
			{
				id: "b",
				kind: "node",
			},
			"income",
		);

		expect(highlight.nodeIds).toEqual(
			new Set([
				"b",
				"a",
				"x",
			]),
		);
		expect(highlight.edgeIds).toEqual(
			new Set([
				"a-b",
				"x-b",
			]),
		);
	});

	it("does not re-enter an earlier flow order through a cycle edge", () => {
		const highlight = readEditorOriginFlowHighlight(flow, positions, {
			id: "d",
			kind: "node",
		});

		expect(highlight.nodeIds).toEqual(
			new Set([
				"d",
			]),
		);
		expect(highlight.edgeIds).toEqual(new Set());
	});

	it("starts an edge selection at that connection without including sibling inputs", () => {
		const highlight = readEditorOriginFlowHighlight(flow, positions, {
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
			]),
		);
	});

	it("keeps a selected backward connection before continuing forward from its target", () => {
		const highlight = readEditorOriginFlowHighlight(flow, positions, {
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

	it("returns an empty highlight for a stale selection", () => {
		expect(
			readEditorOriginFlowHighlight(flow, positions, {
				id: "missing",
				kind: "node",
			}),
		).toEqual({
			edgeIds: new Set(),
			nodeIds: new Set(),
		});
	});
});
