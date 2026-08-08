import { describe, expect, it } from "vitest";

import type { EditorItemOriginEdge } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowVisualConnections } from "~/ui/item/editor/readEditorOriginFlowVisualConnections";

const edge = (id: string, source: string, target: string): EditorItemOriginEdge => ({
	id,
	operationId: `operation:${id}`,
	role: "output",
	source,
	target,
});

describe("readEditorOriginFlowVisualConnections", () => {
	it("collapses duplicate directed pairs while preserving every logical edge id", () => {
		const connections = readEditorOriginFlowVisualConnections([
			edge("edge:2", "item:a", "item:b"),
			edge("edge:1", "item:a", "item:b"),
			edge("edge:3", "item:b", "item:a"),
		]);

		expect(connections).toEqual([
			{
				edgeIds: [
					"edge:1",
					"edge:2",
				],
				id: "connection:item:a->item:b",
				source: "item:a",
				target: "item:b",
			},
			{
				edgeIds: [
					"edge:3",
				],
				id: "connection:item:b->item:a",
				source: "item:b",
				target: "item:a",
			},
		]);
	});
});
