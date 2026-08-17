import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createPlannerAcquisitionGraphFx } from "~/editor/planner/createPlannerAcquisitionGraphFx";
import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { readPlannerSearchScopeFx } from "~/editor/planner/readPlannerSearchScopeFx";
import { readPlannerSearchScopesFx } from "~/editor/planner/readPlannerSearchScopesFx";
import { resolvePlannerRouteReachabilityFx } from "~/editor/planner/resolvePlannerRouteReachabilityFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const readScope = (props: Parameters<typeof readPlannerSearchScopeFx>[0]) =>
	Effect.runSync(readPlannerSearchScopeFx(props));
const readScopes = (props: Parameters<typeof readPlannerSearchScopesFx>[0]) =>
	Effect.runSync(readPlannerSearchScopesFx(props));

const baseItem = (id: string) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize: 10,
	scope: "any" as const,
	title: id,
	uid: id,
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					drop: [
						{
							itemId,
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "guaranteed" as const,
				},
			],
		},
	],
});

const chanceOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					chance: 0.5,
					drop: [
						{
							itemId,
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "chance" as const,
				},
			],
		},
	],
});

const duplicateChanceOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					chance: 0.4,
					drop: chanceOutput(itemId).set[0].roll[0].drop,
					type: "chance" as const,
				},
				{
					chance: 0.15,
					drop: chanceOutput(itemId).set[0].roll[0].drop,
					type: "chance" as const,
				},
			],
		},
	],
});

const mixedOutput = () => ({
	set: [
		{
			roll: [
				...guaranteedOutput("mixed-target").set[0].roll,
				...chanceOutput("mixed-bonus").set[0].roll,
			],
		},
	],
});

const line = ({
	id,
	inputItemId,
	inputQuantity = 1,
	output,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly inputQuantity?: number;
	readonly output: Record<string, unknown>;
}) => ({
	description: id,
	id,
	input:
		inputItemId === undefined
			? [
					{
						type: "simple" as const,
					},
				]
			: [
					{
						capacity: inputQuantity,
						mode: "consume" as const,
						quantity: {
							max: inputQuantity,
							min: inputQuantity,
						},
						selector: {
							itemId: inputItemId,
							type: "item" as const,
						},
						type: "materials" as const,
					},
				],
	output,
	rules: [],
	runtimeMs: 100,
	title: id,
});

const producer = (id: string, lines: ReadonlyArray<Record<string, unknown>>) => ({
	...baseItem(id),
	lines,
	maxQueueSize: 1,
	type: "producer" as const,
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-search-scope",
		title: "Planner search scope",
		board: {
			height: 2,
			width: 12,
		},
		inventory: {
			height: 2,
			width: 8,
		},
	},
	start: {
		board: [
			"source-a",
			"source-b",
			"raw-rebuilder",
			"source-rebuilder",
			"target-producer",
			"random-producer",
			"duplicate-producer",
			"mixed-producer",
			"charged-producer",
			"temporary-token",
			"merge-target",
		].map((itemId, x) => ({
			itemId,
			space: 0,
			x,
			y: 0,
		})),
		currentSpace: 0,
		inventory: [
			{
				itemId: "raw",
				quantity: 1,
			},
			{
				itemId: "merge-source",
				quantity: 1,
			},
		],
	},
	items: {
		hero: {
			...baseItem("hero"),
			type: "simple",
		},
		raw: {
			...baseItem("raw"),
			type: "simple",
		},
		"raw-rebuilder": producer("raw-rebuilder", [
			line({
				id: "line:raw-rebuilder",
				inputItemId: "part",
				output: guaranteedOutput("raw"),
			}),
		]),
		"source-a": producer("source-a", [
			line({
				id: "line:source-a",
				inputItemId: "raw",
				output: guaranteedOutput("part"),
			}),
		]),
		"source-b": producer("source-b", [
			line({
				id: "line:source-b",
				inputItemId: "raw",
				output: guaranteedOutput("part"),
			}),
		]),
		"source-rebuilder": producer("source-rebuilder", [
			line({
				id: "line:source-rebuilder",
				inputItemId: "part",
				output: guaranteedOutput("source-a"),
			}),
		]),
		part: {
			...baseItem("part"),
			type: "simple",
		},
		"target-producer": producer("target-producer", [
			line({
				id: "line:target",
				inputItemId: "part",
				output: guaranteedOutput("target"),
			}),
		]),
		target: {
			...baseItem("target"),
			type: "simple",
		},
		"random-producer": producer("random-producer", [
			line({
				id: "line:random",
				output: chanceOutput("random-target"),
			}),
		]),
		"random-target": {
			...baseItem("random-target"),
			type: "simple",
		},
		"duplicate-producer": producer("duplicate-producer", [
			line({
				id: "line:duplicate",
				output: duplicateChanceOutput("duplicate-target"),
			}),
		]),
		"duplicate-target": {
			...baseItem("duplicate-target"),
			type: "simple",
		},
		"mixed-producer": producer("mixed-producer", [
			line({
				id: "line:mixed",
				output: mixedOutput(),
			}),
		]),
		"mixed-target": {
			...baseItem("mixed-target"),
			type: "simple",
		},
		"mixed-bonus": {
			...baseItem("mixed-bonus"),
			type: "simple",
		},
		"charged-producer": {
			...producer("charged-producer", [
				{
					...line({
						id: "line:charged",
						output: guaranteedOutput("charged-side-output"),
					}),
					input: [
						{
							charges: {
								cost: 1,
								from: "self",
							},
							type: "simple",
						},
					],
				},
			]),
			charges: {
				amount: 1,
				output: guaranteedOutput("depleted-target"),
			},
		},
		"charged-side-output": {
			...baseItem("charged-side-output"),
			type: "simple",
		},
		"depleted-target": {
			...baseItem("depleted-target"),
			type: "simple",
		},
		"temporary-token": {
			...baseItem("temporary-token"),
			durationMs: 500,
			maxStackSize: 1,
			output: guaranteedOutput("temporary-target"),
			scope: "board",
			type: "temporary",
		},
		"temporary-target": {
			...baseItem("temporary-target"),
			type: "simple",
		},
		"merge-source": {
			...baseItem("merge-source"),
			merge: [
				{
					action: "consume",
					effect: "replace",
					result: "merge-result",
					target: {
						itemId: "merge-target",
						type: "item",
					},
				},
			],
			type: "simple",
		},
		"merge-target": {
			...baseItem("merge-target"),
			type: "simple",
		},
		"merge-result": {
			...baseItem("merge-result"),
			type: "simple",
		},
	},
});

const graph = Effect.runSync(createPlannerAcquisitionGraphFx(config));

const wideningConfigSource: unknown = {
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-search-scope-widening",
		title: "Planner search scope widening",
		board: {
			height: 1,
			width: 3,
		},
		inventory: {
			height: 1,
			width: 2,
		},
	},
	start: {
		board: [
			"short-producer",
			"detour-part-producer",
			"detour-target-producer",
		].map((itemId, x) => ({
			itemId,
			space: 0,
			x,
			y: 0,
		})),
		currentSpace: 0,
		inventory: [
			{
				itemId: "scarce-raw",
				quantity: 1,
			},
			{
				itemId: "detour-raw",
				quantity: 1,
			},
		],
	},
	items: {
		hero: {
			...baseItem("hero"),
			type: "simple",
		},
		"scarce-raw": {
			...baseItem("scarce-raw"),
			type: "simple",
		},
		"detour-raw": {
			...baseItem("detour-raw"),
			type: "simple",
		},
		"short-producer": producer("short-producer", [
			line({
				id: "line:short-target",
				inputItemId: "scarce-raw",
				inputQuantity: 2,
				output: guaranteedOutput("widened-target"),
			}),
		]),
		"detour-part-producer": producer("detour-part-producer", [
			line({
				id: "line:detour-part",
				inputItemId: "detour-raw",
				output: guaranteedOutput("detour-part"),
			}),
		]),
		"detour-target-producer": producer("detour-target-producer", [
			line({
				id: "line:detour-target",
				inputItemId: "detour-part",
				output: guaranteedOutput("widened-target"),
			}),
		]),
		"detour-part": {
			...baseItem("detour-part"),
			type: "simple",
		},
		"widened-target": {
			...baseItem("widened-target"),
			type: "simple",
		},
	},
};

const wideningConfig = GameConfigSchema.parse(wideningConfigSource);
const wideningGraph = Effect.runSync(createPlannerAcquisitionGraphFx(wideningConfig));

const syntheticRequirement = (
	itemId: string,
	usage: PlannerAcquisitionRequirement["usage"] = "consume",
): PlannerAcquisitionRequirement => ({
	itemId,
	minimumQuantity: 1,
	source: usage === "presence" ? "line-condition" : "material-input",
	usage,
});

const syntheticRoute = ({
	allOf = [],
	anyOf = [],
	id,
	outputItemId,
}: {
	readonly allOf?: ReadonlyArray<PlannerAcquisitionRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<PlannerAcquisitionRequirement>>;
	readonly id: string;
	readonly outputItemId: string;
}): PlannerAcquisitionRoute => ({
	action: {
		kind: "line",
		lineId: `line:${id}`,
		ownerItemId: `producer:${id}`,
	},
	id,
	kind: "line-output",
	output: {
		expectedQuantity: 1,
		itemId: outputItemId,
		maximumQuantity: 1,
		maximumQuantityProbability: 1,
		occurrenceProbability: 1,
		quantityDistribution: [
			{
				probability: 1,
				quantity: 1,
			},
		],
		resolutionId: `resolution:${id}`,
		selection: "guaranteed",
		stochastic: false,
		witnessId: `witness:${id}`,
	},
	requirements: {
		allOf,
		anyOf,
	},
});

const indexSyntheticRoutes = (
	routes: ReadonlyArray<PlannerAcquisitionRoute>,
	readKeys: (route: PlannerAcquisitionRoute) => ReadonlyArray<string>,
) => {
	const indexed = new Map<string, PlannerAcquisitionRoute[]>();
	for (const route of routes)
		for (const key of new Set(readKeys(route))) {
			const candidates = indexed.get(key) ?? [];
			candidates.push(route);
			indexed.set(key, candidates);
		}
	return indexed;
};

const createSyntheticGraph = ({
	rootItemIds,
	routes,
}: {
	readonly rootItemIds: ReadonlyArray<string>;
	readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
}): PlannerAcquisitionGraph => {
	const roots = new Set(rootItemIds);
	const reachability = Effect.runSync(
		resolvePlannerRouteReachabilityFx({
			rootItemIds: roots,
			routes,
		}),
	);
	const itemIds = new Set([
		...roots,
		...routes.flatMap((route) => [
			route.output.itemId,
			...route.requirements.allOf.map(({ itemId }) => itemId),
			...route.requirements.anyOf.flatMap((clause) => clause.map(({ itemId }) => itemId)),
		]),
	]);
	const routesByOutputItemId = indexSyntheticRoutes(routes, (route) => [
		route.output.itemId,
	]);
	const routesByRequiredItemId = indexSyntheticRoutes(routes, (route) => [
		...route.requirements.allOf.map(({ itemId }) => itemId),
		...route.requirements.anyOf.flatMap((clause) => clause.map(({ itemId }) => itemId)),
	]);
	return {
		chargeCapacityByItemId: new Map(),
		componentByItemId: new Map(),
		components: [],
		depthByItemId: reachability.depthByItemId,
		itemIds,
		reachableItemIds: new Set(reachability.depthByItemId.keys()),
		reachableRouteIds: reachability.reachableRouteIds,
		rootItemIds: roots,
		routeDepthById: reachability.routeDepthById,
		routes,
		routesByOutputItemId,
		routesByRequiredItemId,
		startQuantityByItemId: new Map(
			rootItemIds.map((itemId) => [
				itemId,
				1,
			]),
		),
		unreachableItemIds: new Set(
			[
				...itemIds,
			].filter((itemId) => !reachability.depthByItemId.has(itemId)),
		),
		witnessRouteByItemId: reachability.witnessRouteByItemId,
	};
};

const anyOfWideningTargetRoute = syntheticRoute({
	anyOf: [
		[
			syntheticRequirement("alternative-a", "presence"),
			syntheticRequirement("alternative-b", "presence"),
		],
	],
	id: "route:any-of-target",
	outputItemId: "any-of-target",
});
const anyOfWideningGraph = createSyntheticGraph({
	rootItemIds: [
		"root-a",
		"root-b",
	],
	routes: [
		syntheticRoute({
			allOf: [
				syntheticRequirement("root-a"),
			],
			id: "route:alternative-a",
			outputItemId: "alternative-a",
		}),
		syntheticRoute({
			allOf: [
				syntheticRequirement("root-b"),
			],
			id: "route:alternative-b-part",
			outputItemId: "alternative-b-part",
		}),
		syntheticRoute({
			allOf: [
				syntheticRequirement("alternative-b-part"),
			],
			id: "route:alternative-b",
			outputItemId: "alternative-b",
		}),
		anyOfWideningTargetRoute,
	],
});

const renewalWideningGraph = createSyntheticGraph({
	rootItemIds: [
		"fuel",
		"long-renewal-root",
		"short-renewal-root",
	],
	routes: [
		syntheticRoute({
			allOf: [
				syntheticRequirement("fuel"),
			],
			id: "route:renewal-target",
			outputItemId: "renewal-target",
		}),
		syntheticRoute({
			allOf: [
				syntheticRequirement("short-renewal-root"),
			],
			id: "route:short-fuel-renewal",
			outputItemId: "fuel",
		}),
		syntheticRoute({
			allOf: [
				syntheticRequirement("long-renewal-root"),
			],
			id: "route:long-renewal-part",
			outputItemId: "long-renewal-part",
		}),
		syntheticRoute({
			allOf: [
				syntheticRequirement("long-renewal-part"),
			],
			id: "route:long-fuel-renewal",
			outputItemId: "fuel",
		}),
	],
});

describe("readPlannerSearchScopeFx", () => {
	it("includes the shortest renewal route for consumed roots without rebuilding presence roots", () => {
		const scope = readScope({
			graph,
			targetItemId: "target",
		});

		expect(scope.supported).toBe(true);
		expect(
			scope.actions.map(({ action, depth }) => ({
				action,
				depth,
			})),
		).toEqual([
			{
				action: {
					kind: "line",
					lineId: "line:source-a",
					ownerItemId: "source-a",
				},
				depth: 1,
			},
			{
				action: {
					kind: "line",
					lineId: "line:source-b",
					ownerItemId: "source-b",
				},
				depth: 1,
			},
			{
				action: {
					kind: "line",
					lineId: "line:raw-rebuilder",
					ownerItemId: "raw-rebuilder",
				},
				depth: 2,
			},
			{
				action: {
					kind: "line",
					lineId: "line:target",
					ownerItemId: "target-producer",
				},
				depth: 2,
			},
		]);
		expect(scope.itemIds).toEqual([
			"part",
			"raw",
			"raw-rebuilder",
			"source-a",
			"source-b",
			"target",
			"target-producer",
		]);
		expect(scope.unsupportedRoutes).toEqual([]);
	});

	it("keeps a deterministic route when a sibling output is stochastic", () => {
		const scope = readScope({
			graph,
			targetItemId: "mixed-target",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]).toMatchObject({
			action: {
				kind: "line",
				lineId: "line:mixed",
				ownerItemId: "mixed-producer",
			},
			outputMode: "canonical",
			outputItemIds: [
				"mixed-target",
			],
		});
		expect(scope.unsupportedRoutes).toEqual([]);
	});

	it("keeps deterministic merge transitions inside the supported slice", () => {
		const scope = readScope({
			graph,
			targetItemId: "merge-result",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]?.action).toEqual({
			kind: "merge",
			mergeIndex: 0,
			sourceItemId: "merge-source",
			targetItemId: "merge-target",
		});
	});

	it("represents a stochastic output as an existential route witness", () => {
		const scope = readScope({
			graph,
			targetItemId: "random-target",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]).toMatchObject({
			action: {
				kind: "line",
				lineId: "line:random",
				ownerItemId: "random-producer",
			},
			outputMode: "existential",
			outputWitness: {
				outputItemId: "random-target",
				source: {
					lineId: "line:random",
					ownerItemId: "random-producer",
					type: "line",
				},
				witness: {
					dropIndex: 0,
					itemId: "random-target",
					rollIndex: 0,
					setIndex: 0,
				},
			},
		});
		expect(scope.unsupportedRoutes).toEqual([]);
	});

	it("deduplicates equivalent stochastic engine branches before search", () => {
		const scope = readScope({
			graph,
			targetItemId: "duplicate-target",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]).toMatchObject({
			action: {
				kind: "line",
				lineId: "line:duplicate",
				ownerItemId: "duplicate-producer",
			},
			outputMode: "existential",
			outputWitness: {
				outputItemId: "duplicate-target",
				statistics: {
					maximumQuantityProbability: 0.4,
				},
			},
		});
		expect(scope.actions[0]?.routeIds).toHaveLength(2);
	});

	it("keeps explicit temporary expiry inside the supported slice", () => {
		const scope = readScope({
			graph,
			targetItemId: "temporary-target",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]).toMatchObject({
			action: {
				itemId: "temporary-token",
				kind: "temporary-expiry",
			},
			outputMode: "canonical",
			outputItemIds: [
				"temporary-target",
			],
		});
		expect(scope.unsupportedRoutes).toEqual([]);
	});

	it("keeps charge depletion tied to its authored spender line", () => {
		const scope = readScope({
			graph,
			targetItemId: "depleted-target",
		});

		expect(scope.supported).toBe(true);
		expect(scope.actions).toHaveLength(1);
		expect(scope.actions[0]).toMatchObject({
			action: {
				kind: "line",
				lineId: "line:charged",
				ownerItemId: "charged-producer",
			},
			outputMode: "canonical",
			outputItemIds: [
				"depleted-target",
			],
		});
		expect(scope.unsupportedRoutes).toEqual([]);
	});
	it("opens target-relevant route detours as distinct cumulative scopes", () => {
		const scopes = readScopes({
			graph: wideningGraph,
			targetItemId: "widened-target",
		});

		expect(scopes).toHaveLength(2);
		const [shortest, widened] = scopes;
		expect(shortest?.maximumDetourDepth).toBe(0);
		expect(shortest?.actions.map(({ actionId }) => actionId)).toEqual([
			'["line","short-producer","line:short-target"]',
		]);
		expect(widened?.maximumDetourDepth).toBe(1);
		expect(widened?.actions.map(({ actionId }) => actionId)).toEqual([
			'["line","detour-part-producer","line:detour-part"]',
			'["line","short-producer","line:short-target"]',
			'["line","detour-target-producer","line:detour-target"]',
		]);
		expect(widened?.preferredRouteByItemId.get("widened-target")?.action).toEqual({
			kind: "line",
			lineId: "line:detour-target",
			ownerItemId: "detour-target-producer",
		});
		expect(shortest?.choices).toContainEqual(
			expect.objectContaining({
				alternativeCount: 2,
				alternativeIndex: 0,
				depthExcess: 0,
				itemId: "widened-target",
				routeId: shortest.preferredRouteByItemId.get("widened-target")?.id,
				type: "acquisition-route",
			}),
		);
		expect(widened?.choices).toContainEqual(
			expect.objectContaining({
				alternativeCount: 2,
				alternativeIndex: 1,
				depthExcess: 1,
				itemId: "widened-target",
				routeId: widened.preferredRouteByItemId.get("widened-target")?.id,
				type: "acquisition-route",
			}),
		);
		expect(shortest?.routeIds.every((routeId) => widened?.routeIds.includes(routeId))).toBe(
			true,
		);
	});

	it("widens authored any-of requirements before declaring the route exhausted", () => {
		const scopes = readScopes({
			graph: anyOfWideningGraph,
			targetItemId: "any-of-target",
		});

		expect(scopes).toHaveLength(2);
		const clauseId = JSON.stringify([
			"route-requirement-clause",
			anyOfWideningTargetRoute.id,
			0,
		]);
		expect(scopes[0]?.preferredRequirementByClauseId.get(clauseId)?.itemId).toBe(
			"alternative-a",
		);
		expect(scopes[1]?.preferredRequirementByClauseId.get(clauseId)?.itemId).toBe(
			"alternative-b",
		);
		expect(scopes[1]?.choices).toContainEqual(
			expect.objectContaining({
				alternativeCount: 2,
				alternativeIndex: 1,
				clauseId,
				depthExcess: 1,
				itemId: "alternative-b",
				type: "requirement",
			}),
		);
		expect(scopes[1]?.depthDiscrepancy).toBe(1);
		expect(scopes[0]?.routeIds.every((routeId) => scopes[1]?.routeIds.includes(routeId))).toBe(
			true,
		);
	});

	it("widens reacquisition routes for consumed authored roots", () => {
		const scopes = readScopes({
			graph: renewalWideningGraph,
			targetItemId: "renewal-target",
		});

		expect(scopes).toHaveLength(2);
		expect(scopes[0]?.preferredRenewalRouteByItemId.get("fuel")?.id).toBe(
			"route:short-fuel-renewal",
		);
		expect(scopes[1]?.preferredRenewalRouteByItemId.get("fuel")?.id).toBe(
			"route:long-fuel-renewal",
		);
		expect(scopes[1]?.choices).toContainEqual(
			expect.objectContaining({
				alternativeCount: 2,
				alternativeIndex: 1,
				depthExcess: 1,
				itemId: "fuel",
				routeId: "route:long-fuel-renewal",
				type: "renewal-route",
			}),
		);
		expect(scopes[1]?.maximumDetourDepth).toBe(1);
		expect(scopes[0]?.routeIds.every((routeId) => scopes[1]?.routeIds.includes(routeId))).toBe(
			true,
		);
	});
});
