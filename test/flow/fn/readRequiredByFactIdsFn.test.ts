import { describe, expect, it } from "vitest";

import { readRequiredByFactIdsFn } from "~/flow/fn/readRequiredByFactIdsFn";
import type { AcquisitionGraph, AcquisitionRoute } from "~/flow/type/AcquisitionGraph";

const routeFn = ({
	id,
	inputFactIds = [],
	lineConditionFactIds = [],
	ownerItemId,
	outputFactId,
}: {
	readonly id: string;
	readonly inputFactIds?: ReadonlyArray<string>;
	readonly lineConditionFactIds?: ReadonlyArray<string>;
	readonly ownerItemId: string;
	readonly outputFactId: string;
}): AcquisitionRoute => ({
	durationMs: 0,
	id,
	metadata: {
		kind: "line-output",
		lineId: `line:${id}`,
		lineTitle: id,
		ownerItemId,
	},
	operation: {
		id: `operation:${id}`,
		inputs: inputFactIds.map((factId) => ({
			factId,
			quantity: {
				max: 1,
				min: 1,
			},
		})),
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
		allOf: [
			{
				factId: ownerItemId,
				quantity: 1,
				source: "owner",
				usage: "one-time",
			},
			...inputFactIds.map((factId) => ({
				factId,
				quantity: 1,
				source: "material-input" as const,
				usage: "consume" as const,
			})),
			...lineConditionFactIds.map((factId) => ({
				factId,
				quantity: 1,
				source: "line-condition" as const,
				usage: "ongoing" as const,
			})),
		],
		anyOf: [],
	},
	runMultiplier: 1,
});

describe("required-by acquisition facts", () => {
	it("returns authored owners rather than outputs for direct inputs and conditions", () => {
		const graph: AcquisitionGraph = {
			factIds: [
				"academy",
				"bakery",
				"blueprint-a",
				"blueprint-z",
				"bread",
				"condition-owner",
				"condition-output",
				"morale",
				"output-a",
				"output-z",
			],
			limitations: [],
			roots: [],
			routes: [
				routeFn({
					id: "route-z",
					inputFactIds: [
						"morale",
					],
					ownerItemId: "blueprint-z",
					outputFactId: "output-z",
				}),
				routeFn({
					id: "route-a",
					inputFactIds: [
						"morale",
					],
					ownerItemId: "blueprint-a",
					outputFactId: "output-a",
				}),
				routeFn({
					id: "route-a-duplicate",
					inputFactIds: [
						"morale",
					],
					ownerItemId: "blueprint-a",
					outputFactId: "output-a",
				}),
				routeFn({
					id: "bakery-bread",
					inputFactIds: [
						"morale",
					],
					ownerItemId: "bakery",
					outputFactId: "bread",
				}),
				routeFn({
					id: "condition",
					lineConditionFactIds: [
						"morale",
					],
					ownerItemId: "condition-owner",
					outputFactId: "condition-output",
				}),
				routeFn({
					id: "owner-only",
					ownerItemId: "morale",
					outputFactId: "blueprint-a",
				}),
			],
		};

		expect(readRequiredByFactIdsFn(graph, "morale")).toEqual([
			"bakery",
			"blueprint-a",
			"blueprint-z",
			"condition-owner",
		]);
	});

	it("does not report the authored owner as requiring itself", () => {
		const graph: AcquisitionGraph = {
			factIds: [
				"topaz",
			],
			limitations: [],
			roots: [],
			routes: [
				routeFn({
					id: "expedition",
					inputFactIds: [
						"topaz",
					],
					ownerItemId: "topaz",
					outputFactId: "topaz",
				}),
			],
		};

		expect(readRequiredByFactIdsFn(graph, "topaz")).toEqual([]);
	});
});
