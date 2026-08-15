import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { createProducerExpansionPlannerStrategy } from "~/editor/planner/createProducerExpansionPlannerStrategy";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

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

const guaranteedOutput = (itemId: string) => ({
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

const materialInput = (itemId: string, mode: "consume" | "reserve" = "consume") => ({
	capacity: 1,
	mode,
	quantity: {
		max: 1,
		min: 1,
	},
	selector: {
		itemId,
		type: "item" as const,
	},
	type: "materials" as const,
});

const line = ({
	id,
	inputs = [],
	outputItemId,
	runtimeMs = 100,
}: {
	readonly id: string;
	readonly inputs?: ReadonlyArray<ReturnType<typeof materialInput>>;
	readonly outputItemId: string;
	readonly runtimeMs?: number;
}) => ({
	description: id,
	id,
	input:
		inputs.length === 0
			? [
					{
						type: "simple" as const,
					},
				]
			: inputs,
	output: guaranteedOutput(outputItemId),
	rules: [],
	runtimeMs,
	title: id,
});

const producerItem = ({
	id,
	lines,
}: {
	readonly id: string;
	readonly lines: ReadonlyArray<ReturnType<typeof line>>;
}) => ({
	...baseItem({
		id,
		scope: "board",
	}),
	lines,
	maxQueueSize: 1,
	type: "producer" as const,
});

const createPlanner = (config: GameConfigSchema.Type) =>
	Effect.runSync(
		createPlannerFx({
			config,
			strategy: createProducerExpansionPlannerStrategy(),
		}),
	);

const readExistingProducerConfig = (): GameConfigSchema.Type =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:producer-expansion-existing-producer",
			title: "Existing producer",
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
					itemId: "producer-v2",
					space: 0,
					x: 0,
					y: 0,
				},
				{
					itemId: "builder",
					space: 0,
					x: 1,
					y: 0,
				},
			],
			currentSpace: 0,
		},
		items: {
			hero: simpleItem("hero"),
			builder: producerItem({
				id: "builder",
				lines: [
					line({
						id: "line:builder:producer-v1",
						outputItemId: "producer-v1",
					}),
				],
			}),
			"producer-v1": producerItem({
				id: "producer-v1",
				lines: [
					line({
						id: "line:producer-v1:target",
						outputItemId: "target",
					}),
				],
			}),
			"producer-v2": producerItem({
				id: "producer-v2",
				lines: [
					line({
						id: "line:producer-v2:target",
						outputItemId: "target",
					}),
				],
			}),
			target: simpleItem("target"),
		},
	});

const readConstructedProducerConfig = (): GameConfigSchema.Type =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:producer-expansion-construction",
			title: "Producer construction",
			board: {
				height: 1,
				width: 2,
			},
			inventory: {
				height: 1,
				width: 2,
			},
		},
		start: {
			board: [
				{
					itemId: "town-hall",
					space: 0,
					x: 0,
					y: 0,
				},
				{
					itemId: "material-producer",
					space: 0,
					x: 1,
					y: 0,
				},
			],
			currentSpace: 0,
		},
		items: {
			hero: simpleItem("hero"),
			"town-hall": producerItem({
				id: "town-hall",
				lines: [
					line({
						id: "line:town-hall:blueprint",
						outputItemId: "blueprint",
						runtimeMs: 10,
					}),
				],
			}),
			"material-producer": producerItem({
				id: "material-producer",
				lines: [
					line({
						id: "line:material-producer:material",
						outputItemId: "material",
						runtimeMs: 20,
					}),
				],
			}),
			blueprint: producerItem({
				id: "blueprint",
				lines: [
					line({
						id: "line:blueprint:construct",
						inputs: [
							materialInput("material"),
						],
						outputItemId: "target-producer",
						runtimeMs: 30,
					}),
				],
			}),
			material: simpleItem("material"),
			"target-producer": producerItem({
				id: "target-producer",
				lines: [
					line({
						id: "line:target-producer:target",
						outputItemId: "target",
						runtimeMs: 40,
					}),
				],
			}),
			target: simpleItem("target"),
		},
	});

const readDestructiveUpgradeConfig = (): GameConfigSchema.Type =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:producer-expansion-destructive-upgrade",
			title: "Destructive upgrade",
			board: {
				height: 1,
				width: 3,
			},
			inventory: {
				height: 1,
				width: 2,
			},
		},
		start: {
			board: [
				"old-hall",
				"upgrade-blueprint",
				"final-producer",
			].map((itemId, x) => ({
				itemId,
				space: 0,
				x,
				y: 0,
			})),
			currentSpace: 0,
		},
		items: {
			hero: simpleItem("hero"),
			"old-hall": producerItem({
				id: "old-hall",
				lines: [
					line({
						id: "line:old-hall:legacy-blueprint",
						outputItemId: "legacy-blueprint",
					}),
				],
			}),
			"upgrade-blueprint": producerItem({
				id: "upgrade-blueprint",
				lines: [
					line({
						id: "line:upgrade-hall",
						inputs: [
							materialInput("old-hall"),
						],
						outputItemId: "advanced-hall",
					}),
				],
			}),
			"advanced-hall": simpleItem("advanced-hall", "board"),
			"legacy-blueprint": simpleItem("legacy-blueprint"),
			"final-producer": producerItem({
				id: "final-producer",
				lines: [
					line({
						id: "line:final-target",
						inputs: [
							materialInput("advanced-hall", "reserve"),
							materialInput("legacy-blueprint"),
						],
						outputItemId: "final-target",
					}),
				],
			}),
			"final-target": simpleItem("final-target"),
		},
	});

describe("createProducerExpansionPlannerStrategy", () => {
	it("uses an already available producer before constructing another producer for the same target", async () => {
		const result = await Effect.runPromise(
			createPlanner(readExistingProducerConfig()).estimateFx({
				itemId: "target",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.strategyId).toBe(PlannerStrategyId.producerExpansion);
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","producer-v2","line:producer-v2:target"]',
		]);
	});

	it("constructs a missing producer and records when the infrastructure becomes available", async () => {
		const result = await Effect.runPromise(
			createPlanner(readConstructedProducerConfig()).estimateFx({
				itemId: "target",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","town-hall","line:town-hall:blueprint"]',
			'["line","material-producer","line:material-producer:material"]',
			'["line","blueprint","line:blueprint:construct"]',
			'["line","target-producer","line:target-producer:target"]',
		]);
		expect(result.strategyDiagnostics?.availability).toContainEqual({
			itemId: "target-producer",
			readyAtMs: 60,
		});
		expect(result.economics.expectedAcquiredItems).toContainEqual({
			itemId: "target-producer",
			quantity: 1,
			readyAtMs: 60,
		});
	});

	it("defers a destructive upgrade until the disappearing producer's unseen output was acquired", async () => {
		const result = await Effect.runPromise(
			createPlanner(readDestructiveUpgradeConfig()).estimateFx({
				itemId: "final-target",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","old-hall","line:old-hall:legacy-blueprint"]',
			'["line","upgrade-blueprint","line:upgrade-hall"]',
			'["line","final-producer","line:final-target"]',
		]);
		expect(result.strategyDiagnostics?.deferredDestructiveActionIds).toEqual([
			'["line","upgrade-blueprint","line:upgrade-hall"]',
		]);
	});

	it("uses the official Chicken Coop production chain instead of the stochastic quest shortcut", async () => {
		const config = await readArkiniGameConfigSource();
		const result = await Effect.runPromise(
			createPlanner(config).estimateFx({
				itemId: "item:egg",
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		const actionIds = result.execution.trace.map(({ actionId }) => actionId);
		expect(actionIds).toContain(
			'["line","item:blueprint-chicken-coop-t1","line:blueprint:chicken-coop-t1:construct"]',
		);
		expect(actionIds).toContain(
			'["line","producer:chicken-coop-t1","line:chicken-coop-t1:egg"]',
		);
		expect(actionIds).not.toContain(
			'["line","item:quest:water-carrier","line:quest:water-carrier:complete"]',
		);
		expect(result.economics.expectedAcquiredItems).toContainEqual(
			expect.objectContaining({
				itemId: "producer:chicken-coop-t1",
				quantity: 1,
			}),
		);
	}, 20_000);
});
