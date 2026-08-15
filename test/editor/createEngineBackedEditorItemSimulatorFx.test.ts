import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	type EditorItemPlannerBudget,
	createEngineBackedEditorItemSimulatorFx,
} from "~/editor/simulator/createEngineBackedEditorItemSimulatorFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const createConfig = ({ chance }: { readonly chance?: number } = {}) => {
	const base = createJobTestConfig(2, "board", 75);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		start: {
			...base.start,
			board: [
				{
					itemId: "forge",
					space: 0,
					x: 0,
					y: 0,
				},
			],
			inventory: [
				{
					itemId: "water",
					quantity: 6,
				},
				{
					itemId: "tool",
					quantity: 1,
				},
			],
		},
		items: {
			...base.items,
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					output: {
						set: [
							{
								roll: [
									{
										...(chance === undefined
											? {
													type: "guaranteed" as const,
												}
											: {
													chance,
													type: "chance" as const,
												}),
										drop: [
											{
												itemId: "result",
												quantity: {
													max: 1,
													min: 1,
												},
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				})),
			},
			orphan: {
				...base.items.tool,
				id: "orphan",
				title: "Orphan",
				uid: "orphan",
			},
			result: {
				...base.items.tool,
				id: "result",
				title: "Result",
				uid: "result",
			},
		},
	});
};

const simulate = async (
	config: GameConfigSchema.Type,
	itemId: string,
	quantity = 1,
	budget?: EditorItemPlannerBudget,
) => {
	const simulator = Effect.runSync(createEngineBackedEditorItemSimulatorFx(config));
	return Effect.runPromise(simulator.simulateFx(itemId, quantity, budget));
};

describe("createEngineBackedEditorItemSimulatorFx", () => {
	it("projects one deterministic engine-valid trace into the editor facade", async () => {
		const estimate = await simulate(createConfig(), "result");
		expect(estimate).toMatchObject({
			chargeCost: [],
			cost: [
				{
					itemId: "water",
					quantity: 3,
				},
			],
			itemId: "result",
			planner: {
				diagnostics: null,
				expectedActionRuns: 1,
				observedActionRuns: 1,
				observedRuntimeMs: 75,
				outputCertainty: "deterministic",
				selectedWitnessProbability: 1,
				strategyId: "editor",
				type: "completed",
			},
			quantity: 1,
			requiredInfrastructure: [
				{
					itemId: "forge",
					quantity: 1,
				},
			],
			runtimeMs: 75,
			status: "estimated",
			totalChargeCost: 0,
			totalCostQuantity: 3,
		});
		expect(
			estimate.planner?.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId),
		).toEqual([
			"editor",
			"producer-expansion",
		]);
		expect(estimate.infrastructureItemIds).toEqual(
			new Set([
				"forge",
				"tool",
			]),
		);
		expect(estimate.operations).toEqual([
			expect.objectContaining({
				label: "Run",
				lineId: "line:forge:run",
				ownerItemId: "forge",
				runs: 1,
				runtimeMs: 75,
			}),
		]);
	});

	it("keeps concrete stochastic feasibility separate from expected economics", async () => {
		const estimate = await simulate(
			createConfig({
				chance: 0.5,
			}),
			"result",
		);
		expect(estimate).toMatchObject({
			cost: [
				{
					itemId: "water",
					quantity: 6,
				},
			],
			planner: {
				expectedActionRuns: 2,
				observedActionRuns: 1,
				observedRuntimeMs: 75,
				outputCertainty: "possible",
				selectedWitnessProbability: 0.5,
				type: "completed",
			},
			runtimeMs: 150,
			status: "estimated",
			totalCostQuantity: 6,
		});
		expect(estimate.operations).toEqual([
			expect.objectContaining({
				runs: 2,
				runtimeMs: 150,
			}),
		]);
		expect(estimate.warnings).toHaveLength(1);
	});

	it("projects only graph-certified impossibility as no-finite-path", async () => {
		const estimate = await simulate(createConfig(), "orphan");
		expect(estimate).toMatchObject({
			planner: {
				diagnostics: {
					attemptedRoutePlans: 0,
					routePlans: [],
				},
				proofType: "no-finite-path",
				type: "no-finite-path",
			},
			status: "no-finite-path",
		});
		expect(estimate.blockers).toContainEqual(
			expect.objectContaining({
				code: "missing-source",
				itemId: "orphan",
			}),
		);
	});

	it("preserves bounded search exhaustion as inconclusive", async () => {
		const estimate = await simulate(createConfig(), "result", 2, {
			bestFirst: {
				maximumExpandedStates: 1,
			},
			constructive: {
				maximumExpandedBranches: 1,
			},
			producerExpansion: {
				maximumExpandedActions: 1,
			},
		});
		expect(estimate).toMatchObject({
			planner: {
				budgetLimit: "maximumExpandedStates",
				reason: "search-budget",
				strategyId: "editor",
				type: "inconclusive",
			},
			status: "inconclusive",
		});
		expect(estimate.blockers).toEqual([]);
		expect(estimate.warnings).toEqual([
			expect.stringContaining("inconclusive"),
		]);
	});
});
