import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	auditPlannerCoverageFx,
	type PlannerCoverageAuditProgress,
} from "~/editor/planner/auditPlannerCoverageFx";
import { auditPlannerCoverageTiersFx } from "~/editor/planner/auditPlannerCoverageTiersFx";
import type { PlannerCoverageTierAuditProgress } from "~/editor/planner/PlannerCoverageTierAudit";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const baseItem = (id: string) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize: 10,
	scope: "any" as const,
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

const simpleLine = ({
	id,
	outputItemId,
}: {
	readonly id: string;
	readonly outputItemId: string;
}) => ({
	description: id,
	id,
	input: [
		{
			type: "simple" as const,
		},
	],
	output: output(outputItemId),
	rules: [],
	runtimeMs: 100,
	title: id,
});

const materialLine = ({
	id,
	inputItemId,
	outputItemId,
}: {
	readonly id: string;
	readonly inputItemId: string;
	readonly outputItemId: string;
}) => ({
	description: id,
	id,
	input: [
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
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "producer-a",
	},
	meta: {
		id: "game:planner-coverage-audit",
		title: "Planner coverage audit",
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
				itemId: "producer-a",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "producer-b",
				space: 0,
				x: 1,
				y: 0,
			},
		],
		currentSpace: 0,
		inventory: [],
	},
	items: {
		middle: {
			...baseItem("middle"),
			type: "simple",
		},
		orphan: {
			...baseItem("orphan"),
			type: "simple",
		},
		"producer-a": {
			...baseItem("producer-a"),
			lines: [
				simpleLine({
					id: "line:middle",
					outputItemId: "middle",
				}),
			],
			maxQueueSize: 1,
			type: "producer",
		},
		"producer-b": {
			...baseItem("producer-b"),
			lines: [
				materialLine({
					id: "line:target",
					inputItemId: "middle",
					outputItemId: "target",
				}),
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

describe("auditPlannerCoverageFx", () => {
	it("summarizes bounded planner coverage without weakening proof boundaries", () => {
		const progress: PlannerCoverageAuditProgress[] = [];
		const report = Effect.runSync(
			auditPlannerCoverageFx({
				budget: {
					maximumExpandedStates: 1,
					maximumQueuedStates: 8,
					maximumRoutePlans: 4,
					maximumTraceLength: 8,
				},
				config,
				onProgress: (entry) =>
					Effect.sync(() => {
						progress.push(entry);
					}),
			}),
		);

		expect(report).toMatchObject({
			budget: {
				maximumExpandedStates: 1,
				maximumQueuedStates: 8,
				maximumRoutePlans: 4,
				maximumTraceLength: 8,
			},
			quantity: 1,
			summary: {
				budgetLimits: [
					{
						count: 1,
						key: "maximumExpandedStates",
					},
				],
				completedCertainties: [
					{
						count: 3,
						key: "deterministic",
					},
				],
				inconclusiveReasons: [
					{
						count: 1,
						key: "search-budget",
					},
				],
				outcomes: {
					completed: 3,
					inconclusive: 1,
					noFinitePath: 1,
				},
				totalItems: 5,
			},
			version: 1,
		});
		expect(report.items.map(({ itemId }) => itemId)).toEqual([
			"middle",
			"orphan",
			"producer-a",
			"producer-b",
			"target",
		]);
		expect(report.items.find(({ itemId }) => itemId === "target")).toMatchObject({
			budgetLimit: "maximumExpandedStates",
			itemId: "target",
			outcome: "inconclusive",
			reason: "search-budget",
		});
		expect(report.items.find(({ itemId }) => itemId === "orphan")).toMatchObject({
			itemId: "orphan",
			outcome: "no-finite-path",
			proofType: "no-finite-path",
			sourceLessItemIds: [
				"orphan",
			],
		});
		expect(progress.map(({ itemId }) => itemId)).toEqual([
			"middle",
			"orphan",
			"producer-a",
			"producer-b",
			"target",
		]);
	});

	it("retries only inconclusive items across increasing budget tiers", () => {
		const progress: PlannerCoverageTierAuditProgress[] = [];
		const report = Effect.runSync(
			auditPlannerCoverageTiersFx({
				config,
				onProgress: (entry) =>
					Effect.sync(() => {
						progress.push(entry);
					}),
				tiers: [
					{
						budget: {
							maximumExpandedStates: 1,
							maximumQueuedStates: 8,
							maximumRoutePlans: 4,
							maximumTraceLength: 8,
						},
						id: "smoke",
					},
					{
						budget: {
							maximumExpandedStates: 8,
							maximumQueuedStates: 8,
							maximumRoutePlans: 4,
							maximumTraceLength: 8,
						},
						id: "deep",
					},
					{
						budget: {
							maximumExpandedStates: 16,
							maximumQueuedStates: 16,
							maximumRoutePlans: 8,
							maximumTraceLength: 16,
						},
						id: "unused",
					},
				],
			}),
		);

		expect(report).toMatchObject({
			summary: {
				finalOutcomes: {
					completed: 4,
					inconclusive: 0,
					noFinitePath: 1,
				},
				resolutionByTier: [
					{
						count: 4,
						tierId: "smoke",
						tierIndex: 1,
					},
					{
						count: 1,
						tierId: "deep",
						tierIndex: 2,
					},
					{
						count: 0,
						tierId: "unused",
						tierIndex: 3,
					},
				],
				saturatedTierId: "deep",
				saturatedTierIndex: 2,
				tierCount: 3,
				totalItems: 5,
				totalSearchAttempts: 6,
				unresolvedItemIds: [],
			},
			tiers: [
				{
					attemptedItems: 5,
					carriedCompleted: 0,
					carriedNoFinitePath: 0,
					cumulativeOutcomes: {
						completed: 3,
						inconclusive: 1,
						noFinitePath: 1,
					},
					id: "smoke",
					newlyCompleted: 3,
					newlyNoFinitePath: 1,
					remainingInconclusive: 1,
				},
				{
					attemptedItems: 1,
					carriedCompleted: 3,
					carriedNoFinitePath: 1,
					cumulativeOutcomes: {
						completed: 4,
						inconclusive: 0,
						noFinitePath: 1,
					},
					id: "deep",
					newlyCompleted: 1,
					newlyNoFinitePath: 0,
					remainingInconclusive: 0,
				},
				{
					attemptedItems: 0,
					carriedCompleted: 4,
					carriedNoFinitePath: 1,
					id: "unused",
					newlyCompleted: 0,
					newlyNoFinitePath: 0,
					remainingInconclusive: 0,
				},
			],
			version: 1,
		});
		expect(report.items.find(({ itemId }) => itemId === "target")).toMatchObject({
			attempts: [
				{
					result: {
						outcome: "inconclusive",
					},
					tierId: "smoke",
					tierIndex: 1,
				},
				{
					result: {
						outcome: "completed",
					},
					tierId: "deep",
					tierIndex: 2,
				},
			],
			finalOutcome: "completed",
			resolvedTierId: "deep",
			resolvedTierIndex: 2,
		});
		expect(report.items.find(({ itemId }) => itemId === "middle")?.attempts).toHaveLength(1);
		expect(progress).toHaveLength(6);
		expect(progress.at(-1)).toMatchObject({
			itemId: "target",
			tierCount: 3,
			tierId: "deep",
			tierIndex: 2,
		});
	});

	it("rejects tiers that lower a previous budget limit", () => {
		const message = Effect.runSync(
			auditPlannerCoverageTiersFx({
				config,
				tiers: [
					{
						budget: {
							maximumExpandedStates: 8,
							maximumQueuedStates: 8,
							maximumRoutePlans: 4,
							maximumTraceLength: 8,
						},
						id: "wide",
					},
					{
						budget: {
							maximumExpandedStates: 4,
							maximumQueuedStates: 8,
							maximumRoutePlans: 4,
							maximumTraceLength: 8,
						},
						id: "narrower",
					},
				],
			}).pipe(
				Effect.flip,
				Effect.map(({ message }) => message),
			),
		);

		expect(message).toContain("lowers maximumExpandedStates from 8 to 4");
	});
});
