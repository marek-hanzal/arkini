import { describe, expect, it } from "vitest";

import { createEstimateTopologyFn } from "~/estimate/fn/createEstimateTopologyFn";
import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";

const routeFn = ({
	allOf = [],
	anyOf = [],
	id,
	output,
	outputCompilation,
	quantity = 1,
}: {
	readonly allOf?: ReadonlyArray<EditorAcquisitionRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
	readonly id: string;
	readonly output: string;
	readonly outputCompilation?: "state-space-unsupported";
	readonly quantity?: number;
}): EditorAcquisitionRoute => ({
	durationMs: 1,
	id,
	metadata: {
		kind: "line-output",
		lineId: id,
		lineTitle: id,
		ownerItemId: "owner",
	},
	...(outputCompilation === undefined
		? {}
		: {
				operation: {
					id: `${id}:operation`,
					inputs: [],
					outputCompilation,
				},
			}),
	output: {
		annotation: {
			alternativeSet: false,
			placement: "drop",
			quantity: {
				max: quantity,
				min: quantity,
			},
			selectionKind: "guaranteed",
		},
		factId: output,
		quantityDistribution: [
			{
				probability: 1,
				quantity,
			},
		],
	},
	requirements: {
		allOf,
		anyOf,
	},
	runMultiplier: 1,
});

const requirementFn = (
	factId: string,
	source: EditorAcquisitionRequirement["source"] = "material-input",
): EditorAcquisitionRequirement => ({
	factId,
	quantity: 3,
	source,
	usage: "consume",
});

describe("createEstimateTopologyFn", () => {
	it("keeps component identity and seeded projection independent of insertion order", () => {
		const factIds = [
			"cycle-z",
			"self",
			"dag-b",
			"disconnected",
			"cycle-a",
			"dag-a",
		];
		const routes = [
			routeFn({
				allOf: [
					requirementFn("cycle-a"),
				],
				id: "cycle-z:a",
				output: "cycle-z",
			}),
			routeFn({
				allOf: [
					requirementFn("dag-b"),
				],
				id: "dag-a:b",
				output: "dag-a",
			}),
			routeFn({
				allOf: [
					requirementFn("self"),
				],
				id: "self:self",
				output: "self",
			}),
			routeFn({
				allOf: [
					requirementFn("cycle-z"),
				],
				id: "cycle-a:z",
				output: "cycle-a",
			}),
		];
		const readTopologyFn = (
			orderedFactIds: ReadonlyArray<string>,
			orderedRoutes: ReadonlyArray<EditorAcquisitionRoute>,
		) =>
			createEstimateTopologyFn({
				factIds: orderedFactIds,
				limitations: [],
				roots: [
					"cycle-z",
					"dag-b",
					"self",
				].map((factId) => ({
					factId,
					quantity: "unbounded" as const,
				})),
				routes: orderedRoutes,
			});

		const expectedComponentEntries = [
			[
				"cycle-a",
				"cycle-a",
			],
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-a",
				"dag-a",
			],
			[
				"dag-b",
				"dag-b",
			],
			[
				"disconnected",
				"disconnected",
			],
			[
				"self",
				"self",
			],
		];
		const expectedSeededEntries = [
			[
				"cycle-a",
				"cycle-a",
			],
			[
				"cycle-z",
				"cycle-a",
			],
			[
				"dag-b",
				"dag-b",
			],
			[
				"self",
				"self",
			],
		];
		const forward = readTopologyFn(factIds, routes);
		const reversed = readTopologyFn(
			[
				...factIds,
			].reverse(),
			[
				...routes,
			].reverse(),
		);

		expect([
			...forward.componentByFact,
		]).toEqual(expectedComponentEntries);
		expect([
			...forward.seededComponentByFact,
		]).toEqual(expectedSeededEntries);
		expect([
			...reversed.componentByFact,
		]).toEqual(expectedComponentEntries);
		expect([
			...reversed.seededComponentByFact,
		]).toEqual(expectedSeededEntries);
	});

	it("projects authored requirements and reaches only finite-yield supported routes", () => {
		const charged = requirementFn("tool", "charged-item");
		const positiveCondition = requirementFn("enabled", "line-condition");
		const graph: EditorAcquisitionGraph = {
			factIds: [
				"root",
				"tool",
				"enabled",
				"target",
				"unsupported",
				"zero",
			],
			limitations: [],
			roots: [
				{
					factId: "root",
					quantity: "unbounded",
				},
				{
					factId: "tool",
					quantity: "unbounded",
				},
			],
			routes: [
				routeFn({
					allOf: [
						charged,
					],
					anyOf: [
						[
							positiveCondition,
							requirementFn("root"),
						],
					],
					id: "z:target",
					output: "target",
				}),
				routeFn({
					id: "a:target",
					output: "target",
				}),
				routeFn({
					id: "unsupported",
					output: "unsupported",
					outputCompilation: "state-space-unsupported",
				}),
				routeFn({
					id: "zero",
					output: "zero",
					quantity: 0,
				}),
			],
		};

		const topology = createEstimateTopologyFn(graph);
		const projected = topology.requirementsByRoute.get(graph.routes[0]!);

		expect(
			[
				...topology.routesByFact.get("target")!,
			].map(({ id }) => id),
		).toEqual([
			"a:target",
			"z:target",
		]);
		expect(projected).toEqual({
			allOf: [
				{
					...charged,
					quantity: 1,
					usage: "one-time",
				},
			],
			anyOf: [
				[
					requirementFn("root"),
				],
			],
		});
		expect(
			[
				...topology.reachableFactIds,
			].sort(),
		).toEqual([
			"root",
			"target",
			"tool",
		]);
		expect(topology.unsupportedRoutes.has(graph.routes[2]!)).toBe(true);
	});
});
