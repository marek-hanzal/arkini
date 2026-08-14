import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { PlannerCurrentStrategyFxService } from "~/editor/planner/PlannerCurrentStrategyFx";
import {
	createGoalDirectedPlannerStrategy,
	readGoalDirectedPlannerStrategySelection,
} from "~/editor/planner/createGoalDirectedPlannerStrategy";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { createPlannerSubproblem, createRootPlannerProblem } from "~/editor/planner/PlannerProblem";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const currentStrategy = ({
	depth,
	path,
}: {
	readonly depth: number;
	readonly path: ReadonlyArray<string>;
}): PlannerCurrentStrategyFxService => ({
	depth,
	id: "adaptive",
	invocationIndex: depth + 1,
	path,
	reason: "test-selection",
});

describe("createGoalDirectedPlannerStrategy", () => {
	it("constructs an official target through adaptive delegated subgoals", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: createGoalDirectedPlannerStrategy({
					constructiveBudget: {
						maximumExpandedBranches: 1_000,
						maximumQueuedBranches: 512,
						maximumTraceLength: 500,
					},
					bestFirstBudget: {
						maximumExpandedStates: 1_000,
						maximumQueuedStates: 16,
						maximumRoutePlans: 16,
						maximumTraceLength: 500,
					},
				}),
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "item:double-tree",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace.at(-1)?.action).toEqual({
			kind: "merge",
			mergeIndex: 0,
			sourceItemId: "item:water",
			targetItemId: "item:tree",
		});
		expect(
			result.sessionDiagnostics.invocations.map(({ goal, path, strategyId }) => ({
				goal: goal.itemId,
				path,
				strategyId,
			})),
		).toEqual([
			{
				goal: "item:double-tree",
				path: [
					"adaptive",
				],
				strategyId: "adaptive",
			},
			{
				goal: "item:double-tree",
				path: [
					"adaptive",
					"constructive",
				],
				strategyId: "constructive",
			},
			{
				goal: "item:water",
				path: [
					"adaptive",
					"constructive",
					"adaptive",
				],
				strategyId: "adaptive",
			},
			{
				goal: "item:water",
				path: [
					"adaptive",
					"constructive",
					"adaptive",
					"best-first",
				],
				strategyId: "best-first",
			},
		]);
		expect(result.sessionDiagnostics.budget.snapshot.strategyInvocations).toBe(4);
		expect(result.sessionDiagnostics.budget.snapshot.engineTransitions).toBeGreaterThanOrEqual(
			result.execution.trace.length,
		);
	});
	it("keeps broad official roots inside bounded best-first search", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: createGoalDirectedPlannerStrategy({
					constructiveBudget: {
						maximumExpandedBranches: 1_000,
						maximumQueuedBranches: 512,
						maximumTraceLength: 500,
					},
					bestFirstBudget: {
						maximumExpandedStates: 1_000,
						maximumQueuedStates: 16,
						maximumRoutePlans: 16,
						maximumTraceLength: 500,
					},
				}),
			}),
		);

		for (const itemId of [
			"item:blueprint-bio-waste-processor-t1",
			"item:feast-plate",
		] as const) {
			const result = await Effect.runPromise(
				planner.estimateFx({
					itemId,
				}),
			);

			expect(result.type).toBe("completed");
			expect(
				result.sessionDiagnostics.invocations.map(({ strategyId }) => strategyId),
			).toEqual([
				"adaptive",
				"best-first",
			]);
			expect(result.sessionDiagnostics.invocations[1]?.reason).toMatch(/^solve-root-goal:/u);
		}
	});

	it("routes by world depth, strategy context, and stochastic output semantics", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = createPlannerAcquisitionGraph(config);
		const runtime = Effect.runSync(createPlannerInitialRuntimeFx(config));
		const root = createRootPlannerProblem({
			goal: {
				itemId: "item:bread",
				quantity: 1,
			},
			runtime,
		});
		const bakery = createPlannerSubproblem({
			activeGoal: {
				itemId: "producer:bakery-t1",
				quantity: 1,
			},
			parent: root,
			runtime,
		});
		const water = createPlannerSubproblem({
			activeGoal: {
				itemId: "item:water",
				quantity: 1,
			},
			parent: root,
			runtime,
		});
		const stone = createRootPlannerProblem({
			goal: {
				itemId: "item:stone",
				quantity: 1,
			},
			runtime,
		});
		const doubleTree = createRootPlannerProblem({
			goal: {
				itemId: "item:double-tree",
				quantity: 1,
			},
			runtime,
		});
		const tree = createRootPlannerProblem({
			goal: {
				itemId: "item:tree",
				quantity: 1,
			},
			runtime,
		});
		const chargedTree = createRootPlannerProblem({
			goal: {
				itemId: "item:tree",
				minimumCharges: 60,
				quantity: 1,
			},
			runtime,
		});
		const branchingBlueprint = createRootPlannerProblem({
			goal: {
				itemId: "item:blueprint-bio-waste-processor-t1",
				quantity: 1,
			},
			runtime,
		});
		const townHallRoot = createRootPlannerProblem({
			goal: {
				itemId: "producer:townhall-t3",
				quantity: 1,
			},
			runtime,
		});
		const library = createPlannerSubproblem({
			activeGoal: {
				itemId: "producer:library-t2",
				quantity: 1,
			},
			parent: townHallRoot,
			runtime,
		});
		const rootContext = currentStrategy({
			depth: 0,
			path: [
				"adaptive",
			],
		});
		const delegatedContext = currentStrategy({
			depth: 2,
			path: [
				"adaptive",
				"constructive",
				"adaptive",
			],
		});
		const nestedContext = currentStrategy({
			depth: 4,
			path: [
				"adaptive",
				"constructive",
				"adaptive",
				"constructive",
				"adaptive",
			],
		});
		const select = (problem: typeof root, strategyContext: PlannerCurrentStrategyFxService) =>
			readGoalDirectedPlannerStrategySelection({
				currentStrategy: strategyContext,
				graph,
				maximumBestFirstDepth: 6,
				maximumConstructiveDelegationDepth: 1,
				maximumConstructiveLinearRootDepth: 1,
				maximumConstructiveMergeRootDepth: 8,
				problem,
			});

		expect(select(stone, rootContext)).toEqual({
			reason: "solve-stochastic-goal",
			strategyId: "best-first",
		});
		expect(select(root, rootContext)).toEqual({
			reason: "solve-root-goal:depth-20",
			strategyId: "best-first",
		});
		expect(select(branchingBlueprint, rootContext)).toEqual({
			reason: "solve-root-goal:depth-6",
			strategyId: "best-first",
		});
		expect(select(doubleTree, rootContext)).toEqual({
			reason: "construct-merge-root-goal:depth-5",
			strategyId: "constructive",
		});
		expect(select(tree, rootContext)).toEqual({
			reason: "construct-linear-root-goal:depth-0",
			strategyId: "constructive",
		});
		expect(select(chargedTree, rootContext)).toEqual({
			reason: "construct-charge-goal",
			strategyId: "constructive",
		});
		expect(select(bakery, delegatedContext)).toEqual({
			reason: "decompose-resource-goal:depth-19",
			strategyId: "constructive",
		});
		expect(select(water, delegatedContext)).toEqual({
			reason: "solve-stochastic-goal",
			strategyId: "best-first",
		});
		expect(select(library, delegatedContext)).toEqual({
			reason: "solve-non-descending-resource-goal:depth-28-from-15",
			strategyId: "best-first",
		});
		expect(select(bakery, nestedContext)).toEqual({
			reason: "solve-bounded-resource-goal:delegation-depth-2",
			strategyId: "best-first",
		});
	});
});
