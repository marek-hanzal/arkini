import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorPlannerStrategy } from "~/editor/planner/createEditorPlannerStrategy";
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

describe("createEditorPlannerStrategy", () => {
	it("uses constructive planning for a compact merge root and best-first for its subgoal", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: createEditorPlannerStrategy(),
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
					strategyId: "constructive",
				},
			],
			mode: "selected-constructive",
			selectedAttemptIndex: 1,
			selection: {
				reason: "construct-merge-root-goal:depth-5",
				strategyId: "constructive",
			},
		});
		expect(result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId)).toEqual([
			"editor",
			"constructive",
			"editor",
			"best-first",
		]);
	});

	it("routes a branching blueprint root directly to bounded best-first search", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: createEditorPlannerStrategy({
					bestFirstBudget: {
						maximumExpandedStates: 1,
					},
				}),
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
					strategyId: "best-first",
				},
			],
			mode: "selected-best-first",
			selectedAttemptIndex: 1,
			selection: {
				reason: "solve-root-goal:depth-2",
				strategyId: "best-first",
			},
		});
		expect(result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId)).toEqual([
			"editor",
			"best-first",
		]);
	});

	it("falls back to best-first over the original snapshot after constructive exhaustion", () => {
		const planner = Effect.runSync(
			createPlannerFx({
				config: createTwoRunConfig(),
				strategy: createEditorPlannerStrategy({
					constructiveBudget: {
						maximumExpandedBranches: 1,
					},
				}),
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
					strategyId: "constructive",
				},
				{
					index: 2,
					outcome: "completed",
					strategyId: "best-first",
				},
			],
			mode: "constructive-fallback-best-first",
			selectedAttemptIndex: 2,
		});
		expect(result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId)).toEqual([
			"editor",
			"constructive",
			"best-first",
		]);
	});
});
