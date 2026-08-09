import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowVisibleHighlightFx } from "~/ui/item/editor/readEditorOriginFlowVisibleHighlightFx";

const Highlight: EditorOriginFlowHighlight = {
	edgeIds: new Set([
		"e1",
		"e2",
		"e3",
	]),
	edgeLevels: new Map([
		[
			"e1",
			1,
		],
		[
			"e2",
			2,
		],
		[
			"e3",
			3,
		],
	]),
	nodeIds: new Set([
		"n0",
		"n1",
		"n2",
		"n3",
	]),
	nodeLevels: new Map([
		[
			"n0",
			0,
		],
		[
			"n1",
			1,
		],
		[
			"n2",
			2,
		],
		[
			"n3",
			3,
		],
	]),
};

describe("readEditorOriginFlowVisibleHighlightFx", () => {
	it("keeps only nodes and edges inside the requested graph level", () => {
		const visible = Effect.runSync(readEditorOriginFlowVisibleHighlightFx(Highlight, 2));

		expect([
			...visible.nodeIds,
		]).toEqual([
			"n0",
			"n1",
			"n2",
		]);
		expect([
			...visible.edgeIds,
		]).toEqual([
			"e1",
			"e2",
		]);
		expect([
			...visible.nodeLevels,
		]).toEqual([
			[
				"n0",
				0,
			],
			[
				"n1",
				1,
			],
			[
				"n2",
				2,
			],
		]);
		expect([
			...visible.edgeLevels,
		]).toEqual([
			[
				"e1",
				1,
			],
			[
				"e2",
				2,
			],
		]);
	});

	it("clamps negative levels to the selected root", () => {
		const visible = Effect.runSync(readEditorOriginFlowVisibleHighlightFx(Highlight, -3));

		expect([
			...visible.nodeIds,
		]).toEqual([
			"n0",
		]);
		expect(visible.edgeIds.size).toBe(0);
	});
});
