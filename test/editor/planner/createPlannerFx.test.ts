import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { createBestFirstPlannerStrategyFx } from "~/editor/planner/createBestFirstPlannerStrategyFx";
import { createConstructivePlannerStrategyFx } from "~/editor/planner/createConstructivePlannerStrategyFx";
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

const createBestFirstPlannerFx = () =>
	createPlannerFx({
		config,
		strategy: Effect.runSync(createBestFirstPlannerStrategyFx()),
	});

const createConstructivePlannerFx = () =>
	createPlannerFx({
		config,
		strategy: Effect.runSync(createConstructivePlannerStrategyFx()),
	});

describe("createPlannerFx", () => {
	it("runs exactly one configured best-first root strategy", async () => {
		const planner = Effect.runSync(createBestFirstPlannerFx());
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
			}),
		);

		expect(planner.strategyId).toBe(PlannerStrategyId.bestFirst);
		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.strategyId).toBe(PlannerStrategyId.bestFirst);
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","producer","line:producer:target"]',
		]);
		expect(result.economics.expectedElapsedMs).toBe(100);
	});

	it("can configure constructive search behind the same public API", async () => {
		const planner = Effect.runSync(createConstructivePlannerFx());
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "target",
			}),
		);

		expect(planner.strategyId).toBe(PlannerStrategyId.constructive);
		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.strategyId).toBe(PlannerStrategyId.constructive);
		expect(result.economics.expectedElapsedMs).toBe(100);
	});

	it("returns the configured strategy's structural proof", async () => {
		const planner = Effect.runSync(createConstructivePlannerFx());
		const result = await Effect.runPromise(
			planner.estimateFx({
				itemId: "orphan",
			}),
		);

		expect(result.type).toBe("no-finite-path");
		if (result.type !== "no-finite-path") return;
		expect(result.strategyId).toBe(PlannerStrategyId.constructive);
		expect(result.proof.type).toBe("no-finite-path");
	});

	it("rejects invalid target quantities before invoking the strategy", () => {
		const planner = Effect.runSync(createBestFirstPlannerFx());

		expect(() =>
			Effect.runSync(
				planner.estimateFx({
					itemId: "target",
					quantity: 0,
				}),
			),
		).toThrow(/positive safe integer/);
	});
});
