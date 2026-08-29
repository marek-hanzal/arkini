import { describe, expect, it } from "vitest";

import { readRanksFn } from "~/ui/item/editor/origin-flow/fn/readRanksFn";
import type { LayoutInput } from "~/ui/item/editor/origin-flow/Layout";

const readRanks = (
	nodeIds: ReadonlyArray<string>,
	directedPairs: ReadonlyArray<{
		readonly source: string;
		readonly target: string;
	}>,
) =>
	readRanksFn(
		{
			edges: [],
			nodes: nodeIds.map((id) => ({
				height: 1,
				id,
				ports: [],
				type: "simple",
				width: 1,
			})),
		} satisfies LayoutInput,
		directedPairs,
	);

describe("readRanksFn", () => {
	it("orders disconnected non-ASCII nodes by stable code units", () => {
		expect([
			...readRanks(
				[
					"ä-node",
					"z-node",
				],
				[],
			),
		]).toEqual([
			[
				"z-node",
				0,
			],
			[
				"ä-node",
				0,
			],
		]);
	});

	it("collapses feedback cycles and keeps longest ranks independent of insertion order", () => {
		const nodeIds = [
			"cycle-b",
			"leaf",
			"self",
			"shortcut",
			"source",
			"disconnected",
			"cycle-a",
			"middle",
		];
		const directedPairs = [
			{
				source: "cycle-b",
				target: "middle",
			},
			{
				source: "middle",
				target: "leaf",
			},
			{
				source: "cycle-a",
				target: "cycle-b",
			},
			{
				source: "self",
				target: "self",
			},
			{
				source: "shortcut",
				target: "leaf",
			},
			{
				source: "source",
				target: "middle",
			},
			{
				source: "cycle-b",
				target: "cycle-a",
			},
		];
		const expected = [
			[
				"cycle-a",
				0,
			],
			[
				"cycle-b",
				0,
			],
			[
				"disconnected",
				0,
			],
			[
				"leaf",
				2,
			],
			[
				"middle",
				1,
			],
			[
				"self",
				0,
			],
			[
				"shortcut",
				0,
			],
			[
				"source",
				0,
			],
		];

		expect([
			...readRanks(nodeIds, directedPairs),
		]).toEqual(expected);
		expect([
			...readRanks(
				[
					...nodeIds,
				].reverse(),
				[
					...directedPairs,
				].reverse(),
			),
		]).toEqual(expected);
	});
});
