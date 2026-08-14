import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createPlannerSearchHarnessFx } from "./support/createPlannerSearchHarnessFx";
import type { AdaptivePlannerStrategyDiagnostics } from "~/editor/planner/AdaptivePlannerStrategy";
import type { PlannerGoalSearchDiagnostics } from "~/editor/planner/PlannerGoalSearch";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { createAdaptivePlannerStrategy } from "~/editor/planner/createAdaptivePlannerStrategy";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createConstructivePlannerStrategy } from "~/editor/planner/createConstructivePlannerStrategy";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { readPlannerRuntimeFingerprint } from "~/editor/planner/readPlannerRuntimeFingerprint";
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
}: {
	readonly id: string;
	readonly inputs?: ReadonlyArray<ReturnType<typeof materialInput>>;
	readonly outputItemId: string;
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
	runtimeMs: 100,
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

const readConfig = ({
	advancedHallReplacesLegacyCapability,
}: {
	readonly advancedHallReplacesLegacyCapability: boolean;
}) =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: advancedHallReplacesLegacyCapability
				? "game:constructive-planner-replacement"
				: "game:constructive-planner-preservation",
			title: "Constructive planner",
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
			"advanced-hall": advancedHallReplacesLegacyCapability
				? producerItem({
						id: "advanced-hall",
						lines: [
							line({
								id: "line:advanced-hall:legacy-blueprint",
								outputItemId: "legacy-blueprint",
							}),
						],
					})
				: simpleItem("advanced-hall", "board"),
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

const readMandatoryRequirementsConfig = () =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:constructive-planner-mandatory-requirements",
			title: "Constructive planner mandatory requirements",
			board: {
				height: 1,
				width: 4,
			},
			inventory: {
				height: 1,
				width: 1,
			},
		},
		start: {
			board: [
				"producer-a",
				"producer-b",
				"producer-c",
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
			"producer-a": producerItem({
				id: "producer-a",
				lines: [
					line({
						id: "line:producer-a:material-a",
						outputItemId: "material-a",
					}),
				],
			}),
			"producer-b": producerItem({
				id: "producer-b",
				lines: [
					line({
						id: "line:producer-b:material-b",
						outputItemId: "material-b",
					}),
				],
			}),
			"producer-c": producerItem({
				id: "producer-c",
				lines: [
					line({
						id: "line:producer-c:material-c",
						outputItemId: "material-c",
					}),
				],
			}),
			"final-producer": producerItem({
				id: "final-producer",
				lines: [
					line({
						id: "line:final-producer:target",
						inputs: [
							materialInput("material-a"),
							materialInput("material-b"),
							materialInput("material-c"),
						],
						outputItemId: "final-target",
					}),
				],
			}),
			"material-a": simpleItem("material-a"),
			"material-b": simpleItem("material-b"),
			"material-c": simpleItem("material-c"),
			"final-target": simpleItem("final-target"),
		},
	});

const search = async ({
	advancedHallReplacesLegacyCapability,
	maximumConcurrentBranches,
	maximumExpandedBranches = 64,
	maximumTraceLength = 16,
}: {
	readonly advancedHallReplacesLegacyCapability: boolean;
	readonly maximumConcurrentBranches: number;
	readonly maximumExpandedBranches?: number;
	readonly maximumTraceLength?: number;
}) => {
	const config = readConfig({
		advancedHallReplacesLegacyCapability,
	});
	const planner = Effect.runSync(createPlannerSearchHarnessFx(config));
	const result = await Effect.runPromise(
		planner.runConstructiveFx("final-target", 1, {
			maximumAgendaDepth: 32,
			maximumConcurrentBranches,
			maximumExpandedBranches,
			maximumQueuedBranches: 32,
			maximumTraceLength,
		}),
	);
	return {
		planner,
		result,
	};
};

describe("constructive engine planner", () => {
	it("delegates destructive prerequisites through adaptive strategy routing and restores the parent branch", async () => {
		const adaptive = createAdaptivePlannerStrategy({
			selectFx: ({ problem }) =>
				Effect.succeed(
					problem.delegationDepth === 0
						? {
								reason: "construct-final-target",
								strategyId: PlannerStrategyId.constructive,
							}
						: {
								reason: `solve-${problem.activeGoal.itemId}`,
								strategyId: PlannerStrategyId.bestFirst,
							},
				),
			strategies: [
				createBestFirstPlannerStrategy(),
				createConstructivePlannerStrategy({
					budget: {
						maximumAgendaDepth: 32,
						maximumConcurrentBranches: 2,
						maximumExpandedBranches: 64,
						maximumQueuedBranches: 32,
						maximumTraceLength: 16,
					},
				}),
			],
		});
		const planner = Effect.runSync(
			createPlannerFx({
				config: readConfig({
					advancedHallReplacesLegacyCapability: false,
				}),
				strategy: adaptive,
			}),
		);
		const result = await Effect.runPromise(
			planner.estimateFx({
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
		expect(
			result.sessionDiagnostics.invocations.filter(
				({ goal, strategyId }) =>
					goal.itemId === "advanced-hall" && strategyId === PlannerStrategyId.bestFirst,
			),
		).toHaveLength(2);
		const diagnostics = result.strategyDiagnostics as AdaptivePlannerStrategyDiagnostics;
		const constructiveDiagnostics = diagnostics.child
			.diagnostics as PlannerGoalSearchDiagnostics;
		expect(constructiveDiagnostics).toMatchObject({
			delegatedCompletedSubgoals: 3,
			delegatedSubgoals: 3,
			deadEndBranches: 1,
		});
	});

	it("prunes a destructive upgrade future and backtracks through the untouched parent snapshot", async () => {
		const { planner, result } = await search({
			advancedHallReplacesLegacyCapability: false,
			maximumConcurrentBranches: 2,
		});

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","old-hall","line:old-hall:legacy-blueprint"]',
			'["line","upgrade-blueprint","line:upgrade-hall"]',
			'["line","final-producer","line:final-target"]',
		]);
		expect(result.diagnostics).toMatchObject({
			deadEndBranches: 1,
			maximumConcurrentBranches: 2,
		});
		expect(planner.initialRuntime.items.some(({ item }) => item.id === "old-hall")).toBe(true);
		expect(
			planner.initialRuntime.items.some(({ item }) => item.id === "legacy-blueprint"),
		).toBe(false);
		expect(result.execution.runtime.items.some(({ item }) => item.id === "old-hall")).toBe(
			false,
		);
		expect(result.execution.runtime.items.some(({ item }) => item.id === "final-target")).toBe(
			true,
		);
	});

	it("keeps branch-budget exhaustion inconclusive", async () => {
		const { planner, result } = await search({
			advancedHallReplacesLegacyCapability: false,
			maximumConcurrentBranches: 4,
			maximumExpandedBranches: 1,
		});

		expect(result.type).toBe("inconclusive");
		if (result.type !== "inconclusive") return;
		expect(result).toMatchObject({
			budgetLimit: "maximumExpandedBranches",
			reason: "search-budget",
		});
		expect(result.diagnostics.expandedBranches).toBe(1);
		expect(readPlannerRuntimeFingerprint(result.bestExecution.runtime)).toBe(
			readPlannerRuntimeFingerprint(planner.initialRuntime),
		);
	});

	it("keeps deterministic branch selection across bounded sibling concurrency", async () => {
		const serial = await search({
			advancedHallReplacesLegacyCapability: false,
			maximumConcurrentBranches: 1,
		});
		const concurrent = await search({
			advancedHallReplacesLegacyCapability: false,
			maximumConcurrentBranches: 4,
		});

		expect(serial.result.type).toBe("completed");
		expect(concurrent.result.type).toBe("completed");
		if (serial.result.type !== "completed" || concurrent.result.type !== "completed") return;
		expect(concurrent.result.execution.trace.map(({ actionId }) => actionId)).toEqual(
			serial.result.execution.trace.map(({ actionId }) => actionId),
		);
		expect(readPlannerRuntimeFingerprint(concurrent.result.execution.runtime)).toBe(
			readPlannerRuntimeFingerprint(serial.result.execution.runtime),
		);
		expect(concurrent.result.diagnostics.winningChoicePath).toEqual(
			serial.result.diagnostics.winningChoicePath,
		);
	});

	it("accepts a completed future exactly at the global trace limit", async () => {
		const { result } = await search({
			advancedHallReplacesLegacyCapability: false,
			maximumConcurrentBranches: 2,
			maximumTraceLength: 3,
		});

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace).toHaveLength(3);
	});

	it("keeps the upgrade future viable when the advanced hall replaces the legacy capability", async () => {
		const { result } = await search({
			advancedHallReplacesLegacyCapability: true,
			maximumConcurrentBranches: 2,
		});

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","upgrade-blueprint","line:upgrade-hall"]',
			'["line","advanced-hall","line:advanced-hall:legacy-blueprint"]',
			'["line","final-producer","line:final-target"]',
		]);
		expect(result.diagnostics).toMatchObject({
			attemptedActions: expect.any(Number),
			winningChoicePath: [
				0,
				0,
			],
		});
	});

	it("keeps mandatory prerequisites on one lazy branch instead of expanding their permutations", async () => {
		const config = readMandatoryRequirementsConfig();
		const planner = Effect.runSync(createPlannerSearchHarnessFx(config));
		const result = await Effect.runPromise(
			planner.runConstructiveFx("final-target", 1, {
				maximumAgendaDepth: 32,
				maximumConcurrentBranches: 4,
				maximumExpandedBranches: 64,
				maximumQueuedBranches: 1,
				maximumTraceLength: 8,
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.trace.map(({ actionId }) => actionId)).toEqual([
			'["line","producer-a","line:producer-a:material-a"]',
			'["line","producer-b","line:producer-b:material-b"]',
			'["line","producer-c","line:producer-c:material-c"]',
			'["line","final-producer","line:final-producer:target"]',
		]);
		expect(result.diagnostics.maximumFrontierSize).toBe(1);
	});

	it("constructs an official multi-step target through the canonical engine", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(createPlannerSearchHarnessFx(config));
		const result = await Effect.runPromise(
			planner.runConstructiveFx("item:double-tree", 1, {
				maximumAgendaDepth: 256,
				maximumConcurrentBranches: 4,
				maximumExpandedBranches: 1_000,
				maximumQueuedBranches: 512,
				maximumTraceLength: 500,
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.execution.runtime.items).toContainEqual(
			expect.objectContaining({
				item: expect.objectContaining({
					id: "item:double-tree",
				}),
			}),
		);
		expect(result.execution.trace.at(-1)?.action).toEqual({
			kind: "merge",
			mergeIndex: 0,
			sourceItemId: "item:water",
			targetItemId: "item:tree",
		});
	});
});
