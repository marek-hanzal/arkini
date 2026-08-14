import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createPlannerSearchHarnessFx } from "./support/createPlannerSearchHarnessFx";
import { readPlannerGoalViability } from "~/editor/planner/readPlannerGoalViability";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const baseItem = (id: string, scope: "any" | "board" = "any") => ({
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

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-goal-viability",
		title: "Planner goal viability",
		board: {
			height: 1,
			width: 1,
		},
		inventory: {
			height: 1,
			width: 2,
		},
	},
	start: {
		board: [
			{
				itemId: "maker",
				space: 0,
				x: 0,
				y: 0,
			},
		],
		currentSpace: 0,
		inventory: [
			{
				itemId: "raw",
				quantity: 1,
			},
		],
	},
	items: {
		hero: {
			...baseItem("hero"),
			type: "simple",
		},
		raw: {
			...baseItem("raw"),
			type: "simple",
		},
		maker: {
			...baseItem("maker", "board"),
			lines: [
				{
					description: "Make target",
					id: "line:make-target",
					input: [
						{
							capacity: 1,
							mode: "consume",
							quantity: {
								max: 1,
								min: 1,
							},
							selector: {
								itemId: "raw",
								type: "item",
							},
							type: "materials",
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
					runtimeMs: 10,
					title: "Make target",
				},
			],
			maxQueueSize: 1,
			type: "producer",
		},
		target: {
			...baseItem("target"),
			type: "simple",
		},
	},
});

const makePlanner = () => Effect.runSync(createPlannerSearchHarnessFx(config));

describe("readPlannerGoalViability", () => {
	it("re-roots structural reachability in the exact runtime snapshot", () => {
		const planner = makePlanner();
		const viable = readPlannerGoalViability({
			goal: {
				itemId: "target",
				quantity: 1,
			},
			graph: planner.graph,
			runtime: planner.initialRuntime,
		});

		expect(viable).toMatchObject({
			availableQuantity: 0,
			reachability: {
				depth: 1,
				type: "reachable",
			},
			type: "reachable",
		});

		const withoutOwner = {
			...planner.initialRuntime,
			items: planner.initialRuntime.items.filter(({ item }) => item.id !== "maker"),
		};
		const deadEnd = readPlannerGoalViability({
			goal: {
				itemId: "target",
				quantity: 1,
			},
			graph: planner.graph,
			runtime: withoutOwner,
		});

		expect(deadEnd).toMatchObject({
			availableQuantity: 0,
			proof: {
				sourceLessItemIds: [
					"maker",
				],
				type: "no-finite-path",
			},
			type: "dead-end",
		});
	});

	it("recognizes a goal already satisfied by a speculative runtime", () => {
		const planner = makePlanner();
		const result = Effect.runSync(planner.runBestFirstFx("target"));
		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;

		expect(
			readPlannerGoalViability({
				goal: {
					itemId: "target",
					quantity: 1,
				},
				graph: planner.graph,
				runtime: result.runtime,
			}),
		).toMatchObject({
			availableQuantity: 1,
			type: "satisfied",
		});
	});
});
