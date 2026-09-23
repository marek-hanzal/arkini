import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";
import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { resolveLineRunFx } from "~/production-line/fx/resolveLineRunFx";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const spentUnits = (itemUid: string, cost = 1) => ({
	units: {
		cost,
		from: "target" as const,
	},
	query: {
		distance: "close" as const,
		selector: {
			itemUid,
			type: "item" as const,
		},
	},
	type: "units" as const,
});

const compileConfig = async (
	items: Record<string, unknown>,
	board: TemplateSchema.Type["board"] = [],
) => {
	const result = await Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items,
				start: {
					currentSpace: 0,
					spaces: [
						{
							space: 0,
							templateUid: "initial",
						},
					],
				},
				templates: [
					{
						uid: "initial",
						title: "Initial",
						width: 3,
						height: 3,
						board,
					},
				],
			}),
		]),
	);
	if (result.config === undefined) throw new Error("Expected a valid acquisition fixture.");
	return result.config;
};

describe("createAcquisitionGraphFn", () => {
	it("only projects unit depletion after an exact number of authored spends", async () => {
		const config = await compileConfig(
			{
				payer: {
					...createSimpleItem("payer"),
					units: {
						amount: 3,
						outcome: createOutput([
							{
								itemUid: "depleted-output",
							},
						]),
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "line:spent-output",
							input: [
								spentUnits("payer", 2),
							],
							outcome: createOutput([
								{
									itemUid: "target",
								},
							]),
						}),
					],
				}),
				"depleted-output": createSimpleItem("depleted-output"),
				target: createSimpleItem("target"),
			},
			[
				{
					itemUid: "payer",
					x: 0,
					y: 0,
				},
				{
					itemUid: "producer",
					x: 1,
					y: 0,
				},
			],
		);

		const nonDivisible = createAcquisitionGraphFn(config);
		expect(
			nonDivisible.routes.some(
				(route) =>
					route.metadata.kind === "line-unit-depletion" &&
					route.metadata.lineId === "line:spent-output" &&
					route.metadata.unitOwnerItemUid === "payer",
			),
		).toBe(false);
		const threeRuns = estimateRequestsFn({
			graph: nonDivisible,
			requests: [
				{
					factId: "target",
					quantity: 3,
				},
			],
		})[0]!;
		expect(threeRuns).toMatchObject({
			obtainable: true,
		});
		if (!threeRuns.obtainable) throw new Error("Expected optimistic spent route.");
		expect(threeRuns.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: "payer",
				quantity: 1,
				usage: "one-time",
			}),
		);

		const divisibleConfig = structuredClone(config);
		const payer = divisibleConfig.items.payer;
		if (payer?.units === undefined) throw new Error("Expected a spent payer fixture.");
		payer.units.amount = 4;
		const divisible = createAcquisitionGraphFn(divisibleConfig);
		expect(divisible.routes).toContainEqual(
			expect.objectContaining({
				metadata: expect.objectContaining({
					unitOwnerItemUid: "payer",
					kind: "line-unit-depletion",
					lineId: "line:spent-output",
				}),
				runMultiplier: 2,
				requirements: expect.objectContaining({
					allOf: expect.arrayContaining([
						expect.objectContaining({
							factId: "payer",
							quantity: 1,
							usage: "consume",
						}),
					]),
				}),
			}),
		);
	});

	it("marks both roles of a self-merge as distinct live identities", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "use",
				effect: "keep",
				outcome: createOutput([
					{
						itemUid: "result",
					},
				]),
				target: {
					itemUid: "source",
					type: "item",
				},
			},
		});
		const graph = createAcquisitionGraphFn(config);
		const selfMerge = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-output" &&
				route.metadata.sourceItemUid === "source" &&
				route.metadata.targetItemUid === "source",
		);

		expect(selfMerge?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "source",
					identity: "distinct",
					source: "merge-source",
				}),
				expect.objectContaining({
					factId: "source",
					identity: "distinct",
					source: "merge-target",
				}),
			]),
		);
	});

	it("models Units merges as finite unit use with their depletion output", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "spend",
				effect: "keep",
				outcome: guaranteedMergeOutput(),
				target: {
					itemUid: "target",
					type: "item",
				},
			},
			sourceUnits: {
				amount: 3,
				outcome: guaranteedMergeOutput({
					itemUid: "output:a",
				}),
			},
		});
		const graph = createAcquisitionGraphFn(config);
		const mergeOutput = graph.routes.find(
			(route) => route.metadata.kind === "merge-output" && route.output.factId === "output",
		);
		const depletionOutcome = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-unit-depletion" &&
				route.output.factId === "output:a",
		);

		expect(mergeOutput).toMatchObject({
			unitUses: [
				{
					accounting: "single-payer-exact",
					payerFactId: "source",
					usableActionRuns: 3,
				},
			],
		});
		expect(depletionOutcome).toMatchObject({
			metadata: {
				kind: "merge-unit-depletion",
				mergeIndex: 0,
				sourceItemUid: "source",
				targetItemUid: "target",
			},
			runMultiplier: 3,
			requirements: {
				allOf: expect.arrayContaining([
					expect.objectContaining({
						factId: "source",
						source: "unit-owner",
						usage: "consume",
					}),
				]),
			},
		});
	});

	it("models a Units target as finite unit use with the target's depletion output", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "consume",
				effect: "spend",
				outcome: guaranteedMergeOutput(),
				target: {
					itemUid: "target",
					type: "item",
				},
			},
			targetUnits: {
				amount: 4,
				outcome: guaranteedMergeOutput({
					itemUid: "output:a",
				}),
			},
		});
		const graph = createAcquisitionGraphFn(config);
		const mergeOutput = graph.routes.find(
			(route) => route.metadata.kind === "merge-output" && route.output.factId === "output",
		);
		const depletionOutcome = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-unit-depletion" &&
				route.metadata.unitOwnerItemUid === "target" &&
				route.output.factId === "output:a",
		);

		expect(mergeOutput).toMatchObject({
			unitUses: [
				{
					accounting: "single-payer-exact",
					payerFactId: "target",
					usableActionRuns: 4,
				},
			],
			requirements: {
				allOf: expect.arrayContaining([
					expect.objectContaining({
						factId: "target",
						source: "merge-target",
						usage: "one-time",
					}),
				]),
			},
		});
		expect(depletionOutcome).toMatchObject({
			metadata: {
				unitOwnerItemUid: "target",
				kind: "merge-unit-depletion",
				mergeIndex: 0,
				sourceItemUid: "source",
				targetItemUid: "target",
			},
			runMultiplier: 4,
			requirements: {
				allOf: expect.arrayContaining([
					expect.objectContaining({
						factId: "target",
						source: "unit-owner",
						usage: "consume",
					}),
				]),
			},
		});
	});

	it("keeps replacement and authored output as correlated operation groups", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "consume",
				effect: "replace",
				outcome: guaranteedMergeOutput({
					itemUid: "result",
					quantity: 2,
				}),
				result: "result",
				target: {
					itemUid: "target",
					type: "item",
				},
			},
		});
		const graph = createAcquisitionGraphFn(config);
		const resultRoutes = graph.routes.filter(
			(route) => route.metadata.kind === "merge-output" && route.output.factId === "result",
		);

		expect(resultRoutes).toHaveLength(2);
		expect(resultRoutes.map(({ output }) => output.quantityDistribution)).toEqual([
			[
				{
					probability: 1,
					quantity: 2,
				},
			],
			[
				{
					probability: 1,
					quantity: 1,
				},
			],
		]);
		expect(resultRoutes[0]?.operation?.outputDistribution).toEqual([
			{
				probability: 1,
				quantities: expect.arrayContaining([
					expect.objectContaining({
						quantity: 2,
					}),
					expect.objectContaining({
						outputGroupId: "output:replacement",
						quantity: 1,
					}),
				]),
			},
		]);
	});

	it("keeps a validator-valid route whose same canonical payer uses two identities", async () => {
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "line:producer:target",
					input: [
						spentUnits("payer"),
						spentUnits("payer"),
					],
					outcome: createOutput([
						{
							itemUid: "target",
						},
					]),
				}),
			],
		});
		const payer = {
			...createSimpleItem("payer"),
			units: {
				amount: 1,
			},
		};
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						payer,
						producer,
						target: createSimpleItem("target"),
					},
				}),
			]),
		);
		expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
		if (result.config === undefined) throw new Error("Expected validator-valid config.");

		const graph = createAcquisitionGraphFn(result.config);
		const route = graph.routes.find(({ output }) => output.factId === "target");
		expect(route).toMatchObject({
			unitUses: [
				{
					accounting: "multi-payer-unsupported",
					payerFactId: "payer",
					usableActionRuns: 0,
				},
			],
			operation: {
				inputs: [
					{
						factId: "payer",
					},
					{
						factId: "payer",
					},
				],
			},
		});

		const owner = {
			id: "runtime:producer",
			item: result.config.items.producer,
			location: {
				position: {
					x: 1,
					y: 0,
				},
				scope: "board" as const,
				space: 0,
			},
			quantity: 1,
			revision: "revision:producer",
		};
		const runtimePayer = (id: string, x: number) => ({
			id,
			item: result.config!.items.payer,
			location: {
				position: {
					x,
					y: 0,
				},
				scope: "board" as const,
				space: 0,
			},
			quantity: 1,
			revision: `revision:${id}`,
		});
		const run = Effect.runSync(
			resolveLineRunFx({
				lineId: "line:producer:target",
				ownerItemId: owner.id,
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						speedUpGameplay: false,
					},
					currentSpace: 0,
					templateUidBySpace: {},
					items: [
						owner,
						runtimePayer("runtime:payer:a", 0),
						runtimePayer("runtime:payer:b", 2),
					],
					jobs: [],

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}).pipe(Effect.provideService(GameConfigFx, result.config)),
		);
		expect(run).toMatchObject({
			input: [
				{
					plan: {
						units: {
							itemId: "runtime:payer:a",
						},
					},
				},
				{
					plan: {
						units: {
							itemId: "runtime:payer:b",
						},
					},
				},
			],
			ready: true,
		});
	});

	it("surfaces authored runtime rules that static duration does not evaluate", async () => {
		const line = createLine({
			id: "line:conditional",
			outcome: createOutput([
				{
					itemUid: "target",
				},
			]),
		});
		const config = await compileConfig({
			producer: createProducerItem({
				id: "producer",
				lines: [
					{
						...line,
						rules: [
							{
								multiplier: 2,
								type: "runtime:multiplier",
								when: [
									{
										query: {
											distance: "close",
											selector: {
												itemUid: "condition",
												type: "item",
											},
										},
										type: "exists",
									},
								],
							},
						],
					},
				],
			}),
			condition: createSimpleItem("condition"),
			target: createSimpleItem("target"),
		});

		const graph = createAcquisitionGraphFn(config);
		expect(graph.limitations).toContain("conditional-runtime-adjustments-ignored");
	});
});
