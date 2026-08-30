import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFn } from "~/flow/fn/createEditorAcquisitionGraphFn";
import { estimateEditorItemsFn } from "~/estimate/domain/fn/estimateEditorItemsFn";
import { compileGameSourcesFx } from "~/game-config/compiler/fx/compileGameSourcesFx";
import { resolveLineRunFx } from "~/production-line/fx/run/resolveLineRunFx";
import type { StartSchema } from "~/game-start/schema/StartSchema";
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
} from "~test/game-config/validation/support/gameValidationTestSource";

const chargedDeposit = (itemId: string, cost = 1) => ({
	charges: {
		cost,
		from: "target" as const,
	},
	query: {
		distance: "close" as const,
		scope: "board" as const,
		selector: {
			itemId,
			type: "item" as const,
		},
	},
	type: "deposit" as const,
});

const compileConfig = async (items: Record<string, unknown>, start?: StartSchema.Type) => {
	const result = await Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items,
				start,
			}),
		]),
	);
	if (result.config === undefined) throw new Error("Expected a valid acquisition fixture.");
	return result.config;
};

describe("createEditorAcquisitionGraphFn", () => {
	it("only projects charge depletion after an exact number of authored spends", async () => {
		const config = await compileConfig(
			{
				payer: {
					...createSimpleItem("payer"),
					charges: {
						amount: 3,
						output: createOutput([
							{
								itemId: "depleted-output",
							},
						]),
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "line:charged-output",
							input: [
								chargedDeposit("payer", 2),
							],
							output: createOutput([
								{
									itemId: "target",
								},
							]),
						}),
					],
				}),
				"depleted-output": createSimpleItem("depleted-output"),
				target: createSimpleItem("target"),
			},
			{
				currentSpace: 0,
				board: [
					{
						itemId: "payer",
						space: 0,
						x: 0,
						y: 0,
					},
					{
						itemId: "producer",
						space: 0,
						x: 1,
						y: 0,
					},
				],
				inventory: [],
				toolbar: [],
			},
		);

		const nonDivisible = createEditorAcquisitionGraphFn(config);
		expect(
			nonDivisible.routes.some(
				(route) =>
					route.metadata.kind === "line-charge-depletion" &&
					route.metadata.lineId === "line:charged-output" &&
					route.metadata.chargedItemId === "payer",
			),
		).toBe(false);
		const threeRuns = estimateEditorItemsFn({
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
		if (!threeRuns.obtainable) throw new Error("Expected optimistic charged route.");
		expect(threeRuns.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: "payer",
				quantity: 1,
				usage: "one-time",
			}),
		);

		const divisibleConfig = structuredClone(config);
		const payer = divisibleConfig.items.payer;
		if (payer?.charges === undefined) throw new Error("Expected a charged payer fixture.");
		payer.charges.amount = 4;
		const divisible = createEditorAcquisitionGraphFn(divisibleConfig);
		expect(divisible.routes).toContainEqual(
			expect.objectContaining({
				metadata: expect.objectContaining({
					chargedItemId: "payer",
					kind: "line-charge-depletion",
					lineId: "line:charged-output",
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
				output: createOutput([
					{
						itemId: "result",
					},
				]),
				target: {
					itemId: "source",
					type: "item",
				},
			},
			sourceMaxCount: 2,
		});
		const graph = createEditorAcquisitionGraphFn(config);
		const selfMerge = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-output" &&
				route.metadata.sourceItemId === "source" &&
				route.metadata.targetItemId === "source",
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

	it("adds replacement and same-result output into one scalar merge yield", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "consume",
				effect: "replace",
				output: guaranteedMergeOutput({
					itemId: "result",
					quantity: 2,
				}),
				result: "result",
				target: {
					itemId: "target",
					type: "item",
				},
			},
		});
		const graph = createEditorAcquisitionGraphFn(config);
		const sameResultOutput = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-output" &&
				route.id.startsWith("merge-output:") &&
				route.output.factId === "result",
		);

		expect(sameResultOutput?.output.expectedYield).toBe(3);
	});

	it("keeps a validator-valid route whose same canonical payer uses two identities", async () => {
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "line:producer:target",
					input: [
						chargedDeposit("payer"),
						chargedDeposit("payer"),
					],
					output: createOutput([
						{
							itemId: "target",
						},
					]),
				}),
			],
		});
		const payer = {
			...createSimpleItem("payer"),
			charges: {
				amount: 1,
			},
			maxCount: 2,
			scope: "board" as const,
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
		expect(result.diagnostics).toEqual([]);
		if (result.config === undefined) throw new Error("Expected validator-valid config.");

		const graph = createEditorAcquisitionGraphFn(result.config);
		const route = graph.routes.find(({ output }) => output.factId === "target");
		expect(route).toMatchObject({
			chargeUses: [
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
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						owner,
						runtimePayer("runtime:payer:a", 0),
						runtimePayer("runtime:payer:b", 2),
					],
					jobs: [],

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}),
		);
		expect(run).toMatchObject({
			input: [
				{
					plan: {
						charges: {
							itemId: "runtime:payer:a",
						},
					},
				},
				{
					plan: {
						charges: {
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
			output: createOutput([
				{
					itemId: "target",
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
											scope: "board",
											selector: {
												itemId: "condition",
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

		const graph = createEditorAcquisitionGraphFn(config);
		expect(graph.limitations).toContain("conditional-runtime-adjustments-ignored");
	});
});
