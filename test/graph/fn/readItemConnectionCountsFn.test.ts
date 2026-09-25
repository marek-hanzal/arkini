import { expect, it } from "vitest";
import { readItemConnectionCountsFn } from "~/graph/fn/readItemConnectionCountsFn";
import type { GraphEdge } from "~/graph/type/GraphFacts";

it("counts parallel occurrences and both self-edge directions without doubling the all total", () => {
	const relationships = [
		[
			"item:A",
			"item:B",
			"merge-target",
		],
		[
			"item:A",
			"item:B",
			"merge-target",
		],
		[
			"item:B",
			"item:A",
			"merge-target",
		],
		[
			"item:A",
			"item:A",
			"line-unit-cost",
		],
		[
			"item:C",
			"item:A",
			"line-material",
		],
		[
			"item:A",
			"item:B",
			"line-item-outcome",
		],
		[
			"item:B",
			"item:A",
			"line-item-outcome",
		],
		[
			"item:A",
			"item:A",
			"rule-reference",
		],
		[
			"item:A",
			"space:1",
			"merge-space",
		],
		[
			"item:B",
			"item:C",
			"merge-target",
		],
	] as const;
	const edges: GraphEdge[] = relationships.map(([from, to, kind], index) => ({
		id: String(index),
		from,
		to,
		kind,
		source: [],
		annotations: {},
	}));
	expect(readItemConnectionCountsFn("A", edges)).toEqual({
		all: 9,
		"merges-into": 2,
		"accepts-merge": 1,
		"required-by": 1,
		inputs: 2,
		produces: 1,
		"produced-by": 1,
		references: 1,
		"referenced-by": 1,
	});
});
