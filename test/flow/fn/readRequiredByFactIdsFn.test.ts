import { describe, expect, it } from "vitest";

import { readRequiredByFactIdsFn } from "~/flow/fn/readRequiredByFactIdsFn";
import type { AcquisitionGraph, AcquisitionRoute } from "~/flow/type/AcquisitionGraph";

const routeFn = ({
	allOf = [],
	anyOf = [],
	id,
	outputFactId,
}: {
	readonly allOf?: ReadonlyArray<string>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<string>>;
	readonly id: string;
	readonly outputFactId: string;
}): AcquisitionRoute => ({
	durationMs: 0,
	id,
	metadata: {
		itemId: outputFactId,
		kind: "temporary-expiry",
	},
	output: {
		annotation: {
			alternativeSet: false,
			placement: undefined,
			quantity: {
				max: 1,
				min: 1,
			},
			selectionKind: "guaranteed",
		},
		factId: outputFactId,
		quantityDistribution: [
			{
				probability: 1,
				quantity: 1,
			},
		],
	},
	requirements: {
		allOf: allOf.map((factId) => ({
			factId,
			quantity: 1,
			source: "temporary-item",
			usage: "consume",
		})),
		anyOf: anyOf.map((clause) =>
			clause.map((factId) => ({
				factId,
				quantity: 1,
				source: "output-condition",
				usage: "ongoing",
			})),
		),
	},
	runMultiplier: 1,
});

describe("required-by acquisition facts", () => {
	it("returns every distinct direct consumer from mandatory and alternative requirements", () => {
		const graph: AcquisitionGraph = {
			factIds: [
				"consumer-a",
				"consumer-z",
				"material",
			],
			limitations: [],
			roots: [],
			routes: [
				routeFn({
					allOf: [
						"material",
					],
					id: "route-z",
					outputFactId: "consumer-z",
				}),
				routeFn({
					anyOf: [
						[
							"other",
							"material",
						],
					],
					id: "route-a",
					outputFactId: "consumer-a",
				}),
				routeFn({
					allOf: [
						"material",
					],
					id: "route-a-duplicate",
					outputFactId: "consumer-a",
				}),
			],
		};

		expect(readRequiredByFactIdsFn(graph, "material")).toEqual([
			"consumer-a",
			"consumer-z",
		]);
	});
});
