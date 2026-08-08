import { describe, expect, it } from "vitest";

import type { EditorItemOriginEdge } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { readEditorOriginFlowConnectedPorts } from "~/ui/item/editor/readEditorOriginFlowConnectedPorts";

const edge = (
	id: string,
	source: string,
	sourcePortId: string | undefined,
	target: string,
	targetPortId: string | undefined,
): EditorItemOriginEdge => ({
	id,
	operationId: `operation:${id}`,
	role: "output",
	source,
	sourcePortId,
	target,
	targetPortId,
});

describe("readEditorOriginFlowConnectedPorts", () => {
	it("includes only ports referenced by an edge", () => {
		const connected = readEditorOriginFlowConnectedPorts([
			edge("one", "item:a", "a:out", "item:b", "b:in"),
			edge("two", "item:a", "a:out-2", "item:c", undefined),
		]);

		expect(
			[
				...connected.get("item:a")!,
			].sort(),
		).toEqual([
			"a:out",
			"a:out-2",
		]);
		expect([
			...connected.get("item:b")!,
		]).toEqual([
			"b:in",
		]);
		expect(connected.has("item:c")).toBe(false);
	});
});
