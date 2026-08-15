import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createPlannerSearchHarnessFx } from "./support/createPlannerSearchHarnessFx";
import { readPlannerGoalAgendaViabilityFx } from "~/editor/planner/readPlannerGoalAgendaViabilityFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const item = (id: string, type: "producer" | "simple" = "simple") => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize: type === "producer" ? 1 : 10,
	scope: type === "producer" ? ("board" as const) : ("any" as const),
	title: id,
	uid: id,
});

const output = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					drop: [
						{
							itemId,
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "guaranteed" as const,
				},
			],
		},
	],
});

const producer = ({
	id,
	inputItemId,
	outputItemId,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly outputItemId: string;
}) => ({
	...item(id, "producer"),
	lines: [
		{
			description: id,
			id: `line:${id}`,
			input:
				inputItemId === undefined
					? [
							{
								type: "simple" as const,
							},
						]
					: [
							{
								capacity: 1,
								mode: "consume" as const,
								quantity: {
									max: 1,
									min: 1,
								},
								selector: {
									itemId: inputItemId,
									type: "item" as const,
								},
								type: "materials" as const,
							},
						],
			output: output(outputItemId),
			rules: [],
			runtimeMs: 100,
			title: id,
		},
	],
	maxQueueSize: 1,
	type: "producer" as const,
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-agenda-viability",
		title: "Planner agenda viability",
		board: {
			height: 1,
			width: 2,
		},
		inventory: {
			height: 1,
			width: 1,
		},
	},
	start: {
		board: [
			{
				itemId: "old-hall",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "upgrade",
				space: 0,
				x: 1,
				y: 0,
			},
		],
		currentSpace: 0,
	},
	items: {
		hero: {
			...item("hero"),
			type: "simple",
		},
		"old-hall": producer({
			id: "old-hall",
			outputItemId: "legacy-blueprint",
		}),
		upgrade: producer({
			id: "upgrade",
			inputItemId: "old-hall",
			outputItemId: "advanced-hall",
		}),
		"legacy-blueprint": {
			...item("legacy-blueprint"),
			type: "simple",
		},
		"advanced-hall": {
			...item("advanced-hall"),
			type: "simple",
		},
	},
});

describe("planner goal agenda viability", () => {
	it("rejects a future snapshot that lost one remaining agenda resource", async () => {
		const planner = Effect.runSync(createPlannerSearchHarnessFx(config));
		const upgrade = await Effect.runPromise(
			planner.runConstructiveFx("advanced-hall", 1, {
				maximumAgendaDepth: 16,
				maximumConcurrentBranches: 1,
				maximumExpandedBranches: 16,
				maximumQueuedBranches: 4,
				maximumTraceLength: 4,
			}),
		);

		expect(upgrade.type).toBe("completed");
		if (upgrade.type !== "completed") return;
		const viability = Effect.runSync(
			readPlannerGoalAgendaViabilityFx({
				goals: [
					{
						itemId: "advanced-hall",
						quantity: 1,
					},
					{
						itemId: "legacy-blueprint",
						quantity: 1,
					},
				],
				graph: planner.graph,
				runtime: upgrade.execution.runtime,
			}),
		);

		expect(viability.type).toBe("dead-end");
		if (viability.type !== "dead-end") return;
		expect(viability.viability.goal.itemId).toBe("legacy-blueprint");
	});
});
