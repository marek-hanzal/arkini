import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/editor/origin-flow/EditorItemOriginFlow";
import type { OriginFlowDirection, Selection } from "~/ui/item/editor/origin-flow/Highlight";
import { readHighlightFn } from "~/ui/item/editor/origin-flow/fn/readHighlightFn";
import { cyclicFlow, producerFlow } from "./readHighlightFn.test/fixture";

const readHighlight = (
	flow: EditorItemOriginFlow,
	selection: Selection,
	direction: OriginFlowDirection = "output",
) => readHighlightFn(flow, selection, direction);

describe("readHighlightFn", () => {
	it("includes every producer branch and its mandatory prerequisites", () => {
		const highlight = readHighlight(producerFlow, {
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
		expect(highlight.nodeLevels.get("item:target")).toBe(0);
		expect(highlight.nodeLevels.get("item:tool")).toBe(2);
	});

	it("terminates a circular acquisition proof", () => {
		const highlight = readHighlight(cyclicFlow, {
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

	it("returns no proof for a stale selection", () => {
		expect(
			readHighlight(producerFlow, {
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
