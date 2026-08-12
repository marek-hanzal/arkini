import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createEngineBackedEditorItemSimulatorFx } from "~/editor/simulator/createEngineBackedEditorItemSimulatorFx";
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

const simulate = (
	config: GameConfigSchema.Type,
	itemId: string,
	quantity = 1,
	budget?: Partial<PlannerSearchBudget>,
) => {
	const simulator = Effect.runSync(createEngineBackedEditorItemSimulatorFx(config));
	return Effect.runSync(simulator.simulateFx(itemId, quantity, budget));
};

describe("createEngineBackedEditorItemSimulatorFx", () => {
	it("projects one deterministic engine-valid trace into the editor facade", () => {
		const estimate = simulate(createConfig(), "result");
		expect(estimate).toMatchObject({
			cost: [
				{
					itemId: "water",
					quantity: 3,
				},
			],
			itemId: "result",
			planner: {
				expectedActionRuns: 1,
				observedActionRuns: 1,
				observedRuntimeMs: 75,
				outputCertainty: "deterministic",
				selectedWitnessProbability: 1,
				type: "completed",
			},
			quantity: 1,
			runtimeMs: 75,
			status: "estimated",
			totalCostQuantity: 3,
		});
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

	it("keeps concrete stochastic feasibility separate from expected economics", () => {
		const estimate = simulate(
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

	it("projects only graph-certified impossibility as no-finite-path", () => {
		const estimate = simulate(createConfig(), "orphan");
		expect(estimate).toMatchObject({
			planner: {
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

	it("preserves bounded search exhaustion as inconclusive", () => {
		const estimate = simulate(createConfig(), "result", 2, {
			maximumExpandedStates: 1,
		});
		expect(estimate).toMatchObject({
			planner: {
				bestAvailableQuantity: 1,
				budgetLimit: "maximumExpandedStates",
				reason: "search-budget",
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
