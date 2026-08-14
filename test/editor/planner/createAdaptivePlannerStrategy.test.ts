import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { AdaptivePlannerStrategyDiagnostics } from "~/editor/planner/AdaptivePlannerStrategy";
import { PlannerCurrentStrategyFx } from "~/editor/planner/PlannerCurrentStrategyFx";
import { PlannerSessionFx } from "~/editor/planner/PlannerSessionFx";
import type {
	AnyPlannerStrategyResult,
	PlannerStrategy,
	PlannerStrategyResult,
} from "~/editor/planner/PlannerStrategy";
import type { PlannerStrategyEnvironment } from "~/editor/planner/PlannerStrategyEnvironment";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { createAdaptivePlannerStrategy } from "~/editor/planner/createAdaptivePlannerStrategy";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createConstructivePlannerStrategy } from "~/editor/planner/createConstructivePlannerStrategy";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const baseItem = ({
	id,
	scope = "any",
}: {
	readonly id: string;
	readonly scope?: "any" | "board";
}) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize: scope === "board" ? 1 : 10,
	scope,
	title: id,
	uid: id,
});

const simpleItem = (id: string, scope: "any" | "board" = "any") => ({
	...baseItem({
		id,
		scope,
	}),
	type: "simple" as const,
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:adaptive-planner",
		title: "Adaptive planner",
		board: {
			height: 1,
			width: 1,
		},
		inventory: {
			height: 1,
			width: 1,
		},
	},
	start: {
		board: [
			{
				itemId: "producer",
				space: 0,
				x: 0,
				y: 0,
			},
		],
		currentSpace: 0,
	},
	items: {
		hero: simpleItem("hero"),
		producer: {
			...baseItem({
				id: "producer",
				scope: "board",
			}),
			lines: [
				{
					description: "Produce target",
					id: "line:producer:target",
					input: [
						{
							type: "simple",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										drop: [
											{
												itemId: "target",
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
					rules: [],
					runtimeMs: 100,
					title: "Produce target",
				},
			],
			maxQueueSize: 1,
			type: "producer",
		},
		target: simpleItem("target"),
	},
});

const projectResult = <StrategyId extends string, Diagnostics>(
	strategyId: StrategyId,
	diagnostics: Diagnostics,
	result: AnyPlannerStrategyResult,
): PlannerStrategyResult<StrategyId, Diagnostics> => {
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics,
				execution: result.execution,
				metrics: result.metrics,
				strategyId,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics,
				metrics: result.metrics,
				proof: result.proof,
				strategyId,
				type: "no-finite-path",
			};
		case "inconclusive":
			return {
				bestAvailableQuantity: result.bestAvailableQuantity,
				blockedActionIds: result.blockedActionIds,
				...(result.budgetLimit === undefined
					? {}
					: {
							budgetLimit: result.budgetLimit,
						}),
				diagnostics,
				metrics: result.metrics,
				reason: result.reason,
				strategyId,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

interface DelegatingDiagnostics {
	readonly currentPath: ReadonlyArray<string>;
	readonly delegatedStrategyId: string;
}

const createDelegatingStrategy = (): PlannerStrategy<
	"delegating",
	DelegatingDiagnostics,
	PlannerStrategyEnvironment
> => ({
	id: "delegating",
	solveFx: Effect.fn("DelegatingStrategy.solveFx")((problem) =>
		Effect.gen(function* () {
			const current = yield* PlannerCurrentStrategyFx;
			const session = yield* PlannerSessionFx;
			const result = yield* session.solveSubgoalFx({
				activeGoal: problem.activeGoal,
				parent: problem,
				reason: "delegate-active-goal",
				runtime: problem.runtime,
			});
			return projectResult(
				"delegating",
				{
					currentPath: current.path,
					delegatedStrategyId: result.strategyId,
				},
				result,
			);
		}),
	),
});

describe("createAdaptivePlannerStrategy", () => {
	it("dynamically reselects a child strategy for a delegated subgoal", async () => {
		const selections: Array<{
			readonly path: ReadonlyArray<string>;
			readonly strategyInvocations: number;
		}> = [];
		const adaptive = createAdaptivePlannerStrategy({
			selectFx: ({ budget, currentStrategy, problem }) => {
				selections.push({
					path: currentStrategy.path,
					strategyInvocations: budget.snapshot.strategyInvocations,
				});
				return Effect.succeed(
					problem.delegationDepth === 0
						? {
								reason: "exercise-subgoal-routing",
								strategyId: "delegating",
							}
						: {
								reason: "solve-concrete-subgoal",
								strategyId: PlannerStrategyId.bestFirst,
							},
				);
			},
			strategies: [
				createDelegatingStrategy(),
				createBestFirstPlannerStrategy(),
			],
		});
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: adaptive,
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.strategyId).toBe(PlannerStrategyId.adaptive);
		expect(result.sessionDiagnostics.budget.snapshot.strategyInvocations).toBe(4);
		expect(
			result.sessionDiagnostics.invocations.map(({ path, strategyId }) => ({
				path,
				strategyId,
			})),
		).toEqual([
			{
				path: [
					"adaptive",
				],
				strategyId: "adaptive",
			},
			{
				path: [
					"adaptive",
					"delegating",
				],
				strategyId: "delegating",
			},
			{
				path: [
					"adaptive",
					"delegating",
					"adaptive",
				],
				strategyId: "adaptive",
			},
			{
				path: [
					"adaptive",
					"delegating",
					"adaptive",
					"best-first",
				],
				strategyId: "best-first",
			},
		]);
		const diagnostics = result.strategyDiagnostics as AdaptivePlannerStrategyDiagnostics;
		expect(diagnostics.selection.strategyId).toBe("delegating");
		expect(diagnostics.child.strategyId).toBe("delegating");
		expect(result.execution.trace).toHaveLength(1);
		expect(selections).toEqual([
			{
				path: [
					"adaptive",
				],
				strategyInvocations: 1,
			},
			{
				path: [
					"adaptive",
					"delegating",
					"adaptive",
				],
				strategyInvocations: 3,
			},
		]);
	});

	it("selects a child from the current immutable world and active goal", async () => {
		const adaptive = createAdaptivePlannerStrategy({
			selectFx: ({ goalViability }) =>
				Effect.succeed({
					reason: `goal-${goalViability.type}`,
					strategyId:
						goalViability.type === "dead-end"
							? PlannerStrategyId.constructive
							: PlannerStrategyId.bestFirst,
				}),
			strategies: [
				createBestFirstPlannerStrategy(),
				createConstructivePlannerStrategy(),
			],
		});
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: adaptive,
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		const diagnostics = result.strategyDiagnostics as AdaptivePlannerStrategyDiagnostics;
		expect(diagnostics.selection).toEqual({
			reason: "goal-reachable",
			strategyId: PlannerStrategyId.bestFirst,
		});
	});

	it("returns inconclusive when the shared session invocation budget is exhausted", async () => {
		const adaptive = createAdaptivePlannerStrategy({
			selectFx: ({ problem }) =>
				Effect.succeed({
					reason: "budget-test",
					strategyId:
						problem.delegationDepth === 0 ? "delegating" : PlannerStrategyId.bestFirst,
				}),
			strategies: [
				createDelegatingStrategy(),
				createBestFirstPlannerStrategy(),
			],
		});
		const planner = Effect.runSync(
			createPlannerFx({
				budget: {
					maximumStrategyInvocations: 3,
				},
				config,
				strategy: adaptive,
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
			}),
		);

		expect(result).toMatchObject({
			budgetLimit: "strategy-invocations",
			reason: "session-budget",
			strategyDiagnostics: null,
			strategyId: PlannerStrategyId.adaptive,
			type: "inconclusive",
		});
		expect(result.sessionDiagnostics.budget.snapshot.strategyInvocations).toBe(3);
		expect(result.sessionDiagnostics.invocations).toHaveLength(3);
	});

	it("shares the engine transition budget across composite strategy execution", async () => {
		const adaptive = createAdaptivePlannerStrategy({
			selectFx: () =>
				Effect.succeed({
					reason: "exercise-global-transition-budget",
					strategyId: PlannerStrategyId.bestFirst,
				}),
			strategies: [
				createBestFirstPlannerStrategy(),
			],
		});
		const planner = Effect.runSync(
			createPlannerFx({
				budget: {
					maximumEngineTransitions: 1,
				},
				config,
				strategy: adaptive,
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
				quantity: 2,
			}),
		);

		expect(result).toMatchObject({
			budgetLimit: "engine-transitions",
			reason: "session-budget",
			strategyId: PlannerStrategyId.adaptive,
			type: "inconclusive",
		});
		expect(result.sessionDiagnostics.budget.snapshot).toMatchObject({
			engineTransitions: 1,
			strategyInvocations: 2,
		});
	});

	it("rejects duplicate or unknown child strategy identities", async () => {
		expect(() =>
			createAdaptivePlannerStrategy({
				selectFx: () =>
					Effect.succeed({
						reason: "duplicate",
						strategyId: PlannerStrategyId.bestFirst,
					}),
				strategies: [
					createBestFirstPlannerStrategy(),
					createBestFirstPlannerStrategy(),
				],
			}),
		).toThrow(/unique/);

		const adaptive = createAdaptivePlannerStrategy({
			selectFx: () =>
				Effect.succeed({
					reason: "unknown",
					strategyId: "missing",
				}),
			strategies: [
				createBestFirstPlannerStrategy(),
			],
		});
		const planner = Effect.runSync(
			createPlannerFx({
				config,
				strategy: adaptive,
			}),
		);

		await expect(
			Effect.runPromise(
				planner.estimateFx({
					itemId: "target",
				}),
			),
		).rejects.toThrow(/unregistered strategy/);
	});
});
