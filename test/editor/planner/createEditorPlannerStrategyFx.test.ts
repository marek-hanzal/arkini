import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorPlannerStrategyFx } from "~/editor/planner/createEditorPlannerStrategyFx";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const createTwoRunConfig = () => {
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
										type: "guaranteed",
									},
								],
							},
						],
					},
				})),
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

describe("createEditorPlannerStrategyFx", () => {
	it("uses producer expansion for a compact official merge root", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: Effect.runSync(createEditorPlannerStrategyFx()),
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "item:double-tree",
			}),
		);

		expect(result.type).toBe("completed");
		expect(result.strategyId).toBe("editor");
		expect(result.strategyDiagnostics).toMatchObject({
			attempts: [
				{
					index: 1,
					outcome: "completed",
					strategyId: "producer-expansion",
				},
			],
			mode: "selected-producer-expansion",
			selectedAttemptIndex: 1,
			selection: null,
		});
		expect(result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId)).toEqual([
			"editor",
			"producer-expansion",
		]);
	});

	it("falls back to bounded best-first search when producer expansion exhausts its budget", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: Effect.runSync(
					createEditorPlannerStrategyFx({
						bestFirstBudget: {
							maximumExpandedStates: 1,
						},
						producerExpansionBudget: {
							maximumExpandedActions: 1,
						},
					}),
				),
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "item:blueprint-library-t1",
			}),
		);

		expect(result.type).toBe("inconclusive");
		expect(result.strategyDiagnostics).toMatchObject({
			attempts: [
				{
					index: 1,
					outcome: "inconclusive",
					strategyId: "producer-expansion",
				},
				{
					index: 2,
					outcome: "inconclusive",
					strategyId: "best-first",
				},
			],
			mode: "producer-expansion-fallback-best-first",
			selectedAttemptIndex: 2,
			selection: {
				reason: "solve-root-goal:depth-2",
				strategyId: "best-first",
			},
		});
		expect(result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId)).toEqual([
			"editor",
			"producer-expansion",
			"best-first",
		]);
	});

	it("falls through producer expansion and constructive search before best-first", () => {
		const planner = Effect.runSync(
			createPlannerFx({
				config: createTwoRunConfig(),
				strategy: Effect.runSync(
					createEditorPlannerStrategyFx({
						constructiveBudget: {
							maximumExpandedBranches: 1,
						},
						producerExpansionBudget: {
							maximumExpandedActions: 1,
						},
					}),
				),
			}),
		);
		const result = Effect.runSync(
			planner.estimateFx({
				itemId: "result",
				quantity: 2,
			}),
		);

		expect(result.type).toBe("completed");
		expect(result.strategyDiagnostics).toMatchObject({
			attempts: [
				{
					index: 1,
					outcome: "inconclusive",
					strategyId: "producer-expansion",
				},
				{
					index: 2,
					outcome: "inconclusive",
					strategyId: "constructive",
				},
				{
					index: 3,
					outcome: "completed",
					strategyId: "best-first",
				},
			],
			mode: "producer-expansion-fallback-constructive-fallback-best-first",
			selectedAttemptIndex: 3,
		});
		expect(result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId)).toEqual([
			"editor",
			"producer-expansion",
			"constructive",
			"best-first",
		]);
	});

	it("uses the producer world to estimate the official Chicken Coop egg route", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: Effect.runSync(createEditorPlannerStrategyFx()),
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "item:egg",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.strategyDiagnostics).toMatchObject({
			attempts: [
				{
					outcome: "completed",
					strategyId: "producer-expansion",
				},
			],
			mode: "selected-producer-expansion",
		});
		const actionIds = result.execution.trace.map(({ actionId }) => actionId);
		expect(actionIds).toContain(
			'["line","item:blueprint-chicken-coop-t1","line:blueprint:chicken-coop-t1:construct"]',
		);
		expect(actionIds).toContain(
			'["line","producer:chicken-coop-t1","line:chicken-coop-t1:egg"]',
		);
	}, 60_000);
});
