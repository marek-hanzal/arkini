import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { createEnginePlannerFx } from "~/editor/planner/createEnginePlannerFx";
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
		id: "game:planner-orchestration",
		title: "Planner orchestration",
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
		orphan: simpleItem("orphan"),
	},
});

describe("createPlannerFx", () => {
	it("exposes registered strategies behind one planner orchestration boundary", () => {
		const planner = Effect.runSync(createPlannerFx(config));

		expect(planner.strategies.bestFirst.id).toBe(PlannerStrategyId.bestFirst);
		expect(planner.strategies.constructive.id).toBe(PlannerStrategyId.constructive);
		expect(planner.strategies.bestFirst.defaultBudget.maximumExpandedStates).toBeGreaterThan(0);
		expect(
			planner.strategies.constructive.defaultBudget.maximumConcurrentBranches,
		).toBeGreaterThan(0);
	});

	it("falls back deterministically after an inconclusive strategy", async () => {
		const planner = Effect.runSync(createPlannerFx(config));
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
				strategyPlan: [
					{
						budget: {
							maximumAgendaDepth: 16,
							maximumConcurrentBranches: 1,
							maximumExpandedBranches: 1,
							maximumQueuedBranches: 8,
							maximumTraceLength: 8,
						},
						strategyId: "constructive",
					},
					{
						strategyId: "best-first",
					},
				],
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.winningStrategyId).toBe("best-first");
		expect(result.winningAttemptIndex).toBe(2);
		expect(result.attempts.map(({ result: attempt }) => attempt.type)).toEqual([
			"inconclusive",
			"completed",
		]);
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","producer","line:producer:target"]',
		]);
		expect(result.economics.expectedElapsedMs).toBe(100);
	});

	it("keeps the production-compatible best-first strategy as the default", async () => {
		const planner = Effect.runSync(createPlannerFx(config));
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.winningStrategyId).toBe("best-first");
		expect(result.attempts).toHaveLength(1);
	});

	it("stops fallback after a strategy returns a structural proof", async () => {
		const planner = Effect.runSync(createPlannerFx(config));
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "orphan",
				strategyPlan: [
					{
						strategyId: "constructive",
					},
					{
						strategyId: "best-first",
					},
				],
			}),
		);

		expect(result.type).toBe("no-finite-path");
		if (result.type !== "no-finite-path") return;
		expect(result.provingStrategyId).toBe("constructive");
		expect(result.attempts).toHaveLength(1);
		expect(result.proof.type).toBe("no-finite-path");
	});

	it("keeps the legacy engine planner entry points on the registered strategies", async () => {
		const planner = Effect.runSync(createEnginePlannerFx(config));
		const legacy = await Effect.runPromise(planner.searchFx("target"));
		const strategy = await Effect.runPromise(
			planner.strategies.bestFirst.searchFx({
				goal: {
					itemId: "target",
					quantity: 1,
				},
				runtime: planner.initialRuntime,
			}),
		);

		expect(legacy.type).toBe("completed");
		expect(strategy.type).toBe("completed");
		if (legacy.type !== "completed" || strategy.type !== "completed") return;
		expect(legacy.trace.map(({ actionId }) => actionId)).toEqual(
			strategy.trace.map(({ actionId }) => actionId),
		);
	});
});
