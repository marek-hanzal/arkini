import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import { createPlannerAcquisitionGraphFx } from "~/editor/planner/createPlannerAcquisitionGraphFx";
import { readPlannerStructuralReachability } from "~/editor/planner/readPlannerStructuralReachability";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const baseItem = ({
	id,
	maxStackSize = 1,
	scope = "any",
}: {
	readonly id: string;
	readonly maxStackSize?: number;
	readonly scope?: "any" | "board" | "inventory" | "toolbar";
}) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize,
	scope,
	title: id,
	uid: id,
});

const guaranteedOutput = (itemId: string, rules: ReadonlyArray<Record<string, unknown>> = []) => ({
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
							rules,
						},
					],
					type: "guaranteed" as const,
				},
			],
		},
	],
});

const simple = (id: string, scope: "any" | "board" = "any") => ({
	...baseItem({
		id,
		scope,
	}),
	type: "simple" as const,
});

const producer = (id: string, lines: ReadonlyArray<Record<string, unknown>>) => ({
	...baseItem({
		id,
		scope: "board" as const,
	}),
	lines,
	maxQueueSize: 1,
	type: "producer" as const,
});

const simpleLine = (id: string, outputItemId: string) => ({
	description: id,
	id,
	input: [
		{
			type: "simple" as const,
		},
	],
	output: guaranteedOutput(outputItemId),
	rules: [],
	runtimeMs: 100,
	title: id,
});

const createConfig = () =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "forge",
		},
		meta: {
			id: "game:planner-acquisition-graph",
			title: "Planner acquisition graph",
			board: {
				height: 2,
				width: 20,
			},
			inventory: {
				height: 2,
				width: 10,
			},
		},
		start: {
			board: [
				...[
					"forge",
					"alternative-forge",
					"vein",
					"catalyst",
					"merge-target",
					"expiry-token",
					"orphan-cell",
					"disabled-producer",
				].map((itemId, x) => ({
					itemId,
					space: 0,
					x,
					y: 0,
				})),
				{
					itemId: "other-space-root",
					space: 1,
					x: 0,
					y: 0,
				},
			],
			currentSpace: 0,
			inventory: [
				{
					itemId: "ore",
					quantity: 2,
				},
				{
					itemId: "merge-source",
					quantity: 1,
				},
			],
			toolbar: [
				{
					itemId: "booster",
					position: {
						x: 0,
						y: 0,
					},
					quantity: 1,
				},
			],
		},
		items: {
			forge: producer("forge", [
				{
					description: "Smelt an ingot.",
					enable: false,
					id: "line:forge:ingot",
					input: [
						{
							capacity: 2,
							mode: "consume",
							quantity: {
								max: 2,
								min: 2,
							},
							selector: {
								itemId: "ore",
								type: "item",
							},
							type: "materials",
						},
						{
							charges: {
								cost: 1,
								from: "target",
							},
							query: {
								distance: "close",
								scope: "board",
								selector: {
									itemId: "vein",
									type: "item",
								},
							},
							type: "deposit",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										drop: [
											{
												itemId: "ingot",
												quantity: {
													max: 1,
													min: 1,
												},
												rules: [
													{
														type: "enable",
														when: [
															{
																query: {
																	scope: "any",
																	selector: {
																		itemId: "booster",
																		type: "item",
																	},
																},
																type: "exists",
															},
														],
													},
												],
											},
											{
												itemId: "slag",
												quantity: {
													max: 1,
													min: 1,
												},
												rules: [],
											},
										],
										type: "guaranteed",
									},
									{
										chance: 0,
										drop: [
											{
												itemId: "ghost-output",
												quantity: {
													max: 1,
													min: 1,
												},
												rules: [],
											},
										],
										type: "chance",
									},
								],
							},
						],
					},
					rules: [
						{
							type: "enable",
							when: [
								{
									count: 1,
									query: {
										scope: "any",
										selector: {
											itemId: "catalyst",
											type: "item",
										},
									},
									type: "count",
								},
							],
						},
						{
							type: "disable",
							when: [
								{
									count: 0,
									query: {
										scope: "any",
										selector: {
											itemId: "other-space-root",
											type: "item",
										},
									},
									type: "count",
								},
								{
									max: 2,
									min: 0,
									query: {
										scope: "any",
										selector: {
											itemId: "disable-bypass",
											type: "item",
										},
									},
									type: "range",
								},
							],
						},
					],
					runtimeMs: 500,
					title: "Ingot",
				},
			]),
			"alternative-forge": producer("alternative-forge", [
				simpleLine("line:alternative-forge:ingot", "ingot"),
			]),
			"disabled-producer": producer("disabled-producer", [
				{
					...simpleLine("line:disabled", "disabled-result"),
					enable: false,
				},
			]),
			"locked-maker": producer("locked-maker", [
				simpleLine("line:locked", "locked-target"),
			]),
			"cycle-a": producer("cycle-a", [
				simpleLine("line:cycle-a", "cycle-b"),
			]),
			"cycle-b": producer("cycle-b", [
				simpleLine("line:cycle-b", "cycle-a"),
			]),
			ore: simple("ore"),
			catalyst: simple("catalyst"),
			booster: simple("booster"),
			"other-space-root": simple("other-space-root", "board"),
			"disable-bypass": simple("disable-bypass"),
			ingot: simple("ingot"),
			slag: simple("slag"),
			"ghost-output": simple("ghost-output"),
			"disabled-result": simple("disabled-result"),
			"locked-target": simple("locked-target"),
			vein: {
				...simple("vein", "board"),
				charges: {
					amount: 2,
					output: guaranteedOutput("seed"),
				},
			},
			seed: simple("seed"),
			"orphan-cell": {
				...simple("orphan-cell", "board"),
				charges: {
					amount: 1,
					output: guaranteedOutput("orphan-seed"),
				},
			},
			"orphan-seed": simple("orphan-seed"),
			"merge-source": {
				...simple("merge-source"),
				merge: [
					{
						action: "consume",
						effect: "replace",
						result: "merged-result",
						target: {
							itemId: "merge-target",
							type: "item",
						},
					},
					{
						action: "consume",
						effect: "replace",
						result: "shadowed-result",
						target: {
							itemId: "merge-target",
							type: "item",
						},
					},
				],
			},
			"merge-target": simple("merge-target", "board"),
			"merged-result": simple("merged-result"),
			"shadowed-result": simple("shadowed-result"),
			"expiry-token": {
				...baseItem({
					id: "expiry-token",
					scope: "board",
				}),
				durationMs: 1_000,
				output: guaranteedOutput("ash"),
				type: "temporary",
			},
			ash: simple("ash", "board"),
		},
	});

const readAllOfItemIds = (route: PlannerAcquisitionRoute | undefined) =>
	route?.requirements.allOf.map(({ itemId }) => itemId) ?? [];

describe("createPlannerAcquisitionGraphFx", () => {
	it("keeps AND facts, disable OR clauses, output-specific rules and every initial space", () => {
		const graph = Effect.runSync(createPlannerAcquisitionGraphFx(createConfig()));
		const ingotRoutes = graph.routesByOutputItemId.get("ingot") ?? [];
		const forgeIngotRoute = ingotRoutes.find(
			(route) => route.kind === "line-output" && route.action.ownerItemId === "forge",
		);
		const forgeSlagRoute = graph.routesByOutputItemId
			.get("slag")
			?.find((route) => route.kind === "line-output" && route.action.ownerItemId === "forge");

		expect(graph.startQuantityByItemId.get("ore")).toBe(2);
		expect(graph.startQuantityByItemId.get("other-space-root")).toBe(1);
		expect(graph.rootItemIds.has("other-space-root")).toBe(true);
		expect(ingotRoutes).toHaveLength(2);
		expect(readAllOfItemIds(forgeIngotRoute)).toEqual(
			expect.arrayContaining([
				"booster",
				"catalyst",
				"forge",
				"ore",
				"vein",
			]),
		);
		expect(readAllOfItemIds(forgeSlagRoute)).not.toContain("booster");
		expect(forgeIngotRoute?.requirements.allOf).toContainEqual(
			expect.objectContaining({
				itemId: "ore",
				minimumQuantity: 2,
				source: "material-input",
				usage: "consume",
			}),
		);
		expect(forgeIngotRoute?.requirements.anyOf).toEqual([
			[
				expect.objectContaining({
					itemId: "disable-bypass",
					minimumQuantity: 3,
					source: "line-condition",
				}),
				expect.objectContaining({
					itemId: "other-space-root",
					minimumQuantity: 1,
					source: "line-condition",
				}),
			],
		]);
		expect(graph.reachableItemIds.has("ingot")).toBe(true);
		expect(graph.reachableRouteIds.has(forgeIngotRoute?.id ?? "missing")).toBe(true);
	});

	it("ties charge depletion to a real spender and omits impossible transitions", () => {
		const graph = Effect.runSync(createPlannerAcquisitionGraphFx(createConfig()));
		const seedRoutes = graph.routesByOutputItemId.get("seed") ?? [];

		expect(seedRoutes).toHaveLength(1);
		expect(seedRoutes[0]).toMatchObject({
			action: {
				kind: "line",
				lineId: "line:forge:ingot",
				ownerItemId: "forge",
			},
			chargedItemId: "vein",
			chargeCosts: [
				1,
			],
			kind: "line-charge-depletion",
			minimumRunsLowerBound: 2,
		});
		expect(graph.routesByOutputItemId.has("orphan-seed")).toBe(false);
		expect(graph.routesByOutputItemId.has("ghost-output")).toBe(false);
		expect(graph.routesByOutputItemId.has("disabled-result")).toBe(false);
		expect(graph.reachableItemIds.has("seed")).toBe(true);
		expect(graph.reachableItemIds.has("orphan-seed")).toBe(false);
	});

	it("uses canonical merge precedence and explicit temporary expiry", () => {
		const graph = Effect.runSync(createPlannerAcquisitionGraphFx(createConfig()));

		expect(graph.routesByOutputItemId.get("merged-result")).toEqual([
			expect.objectContaining({
				action: {
					kind: "merge",
					mergeIndex: 0,
					sourceItemId: "merge-source",
					targetItemId: "merge-target",
				},
				kind: "merge-output",
				source: "replacement",
			}),
		]);
		expect(graph.routesByOutputItemId.has("shadowed-result")).toBe(false);
		expect(graph.routesByOutputItemId.get("ash")).toEqual([
			expect.objectContaining({
				action: {
					itemId: "expiry-token",
					kind: "temporary-expiry",
				},
				kind: "temporary-expiry",
			}),
		]);
		expect(graph.reachableItemIds.has("merged-result")).toBe(true);
		expect(graph.reachableItemIds.has("ash")).toBe(true);
	});

	it("returns finite witnesses and explains source-less and cyclic failures", () => {
		const graph = Effect.runSync(createPlannerAcquisitionGraphFx(createConfig()));
		const reachable = readPlannerStructuralReachability({
			graph,
			itemId: "ingot",
		});
		const sourceLess = readPlannerStructuralReachability({
			graph,
			itemId: "locked-target",
		});
		const cyclic = readPlannerStructuralReachability({
			graph,
			itemId: "cycle-a",
		});

		expect(reachable).toMatchObject({
			depth: 1,
			itemId: "ingot",
			type: "reachable",
		});
		if (reachable.type === "reachable") {
			expect(reachable.witnessItemIds.at(-1)).toBe("ingot");
			expect(reachable.witnessRouteIds).toHaveLength(1);
		}
		expect(sourceLess).toMatchObject({
			cycleComponentIds: [],
			itemId: "locked-target",
			sourceLessItemIds: [
				"locked-maker",
			],
			type: "no-finite-path",
		});
		expect(cyclic).toMatchObject({
			cycleComponentIds: [
				"component:cycle-a",
			],
			itemId: "cycle-a",
			sourceLessItemIds: [],
			type: "no-finite-path",
			unreachableItemIds: [
				"cycle-a",
				"cycle-b",
			],
		});
		expect(graph.componentByItemId.get("cycle-a")).toMatchObject({
			cyclic: true,
			itemIds: [
				"cycle-a",
				"cycle-b",
			],
			unreachableItemIds: [
				"cycle-a",
				"cycle-b",
			],
		});
		expect(
			readPlannerStructuralReachability({
				graph,
				itemId: "missing-item",
			}),
		).toEqual({
			itemId: "missing-item",
			type: "target-missing",
		});
	});

	it("keeps the official game inside the optimistic structural boundary", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createPlannerAcquisitionGraphFx(config));

		expect(
			[
				...graph.unreachableItemIds,
			].sort(),
		).toEqual([
			"item:grape-seed",
			"item:hop-seed",
			"item:wheat-seed",
		]);
		expect(graph.routesByOutputItemId.get("item:double-tree")).toContainEqual(
			expect.objectContaining({
				action: expect.objectContaining({
					kind: "merge",
					sourceItemId: "item:water",
					targetItemId: "item:tree",
				}),
				kind: "merge-output",
			}),
		);
		expect(graph.routesByOutputItemId.get("item:seed")).toContainEqual(
			expect.objectContaining({
				action: expect.objectContaining({
					kind: "line",
					ownerItemId: "producer:lumberjack-t1",
				}),
				chargedItemId: "item:tree",
				kind: "line-charge-depletion",
			}),
		);
	});
});
