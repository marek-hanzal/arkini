import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEnginePlannerFx } from "~/editor/planner/createEnginePlannerFx";
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

const line = ({
	id,
	inputItemId,
	inputQuantity = 1,
	outputItemId,
}: {
	readonly id: string;
	readonly inputItemId: string;
	readonly inputQuantity?: number;
	readonly outputItemId: string;
}) => ({
	description: id,
	id,
	input: [
		{
			capacity: inputQuantity,
			mode: "consume" as const,
			quantity: {
				max: inputQuantity,
				min: inputQuantity,
			},
			selector: {
				itemId: inputItemId,
				type: "item" as const,
			},
			type: "materials" as const,
		},
	],
	output: guaranteedOutput(outputItemId),
	rules: [],
	runtimeMs: 100,
	title: id,
});

const producer = ({
	id,
	lines,
}: {
	readonly id: string;
	readonly lines: ReadonlyArray<Record<string, unknown>>;
}) => ({
	...baseItem(id),
	lines,
	maxQueueSize: 1,
	type: "producer" as const,
});

const configSource: unknown = {
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:planner-route-widening",
		title: "Planner route widening",
		board: {
			height: 1,
			width: 5,
		},
		inventory: {
			height: 1,
			width: 1,
		},
	},
	start: {
		board: [
			"short-part-producer",
			"short-target-producer",
			"detour-part-producer",
			"detour-middle-producer",
			"detour-target-producer",
		].map((itemId, x) => ({
			itemId,
			space: 0,
			x,
			y: 0,
		})),
		currentSpace: 0,
		inventory: [
			{
				itemId: "shared-raw",
				quantity: 1,
			},
		],
	},
	items: {
		hero: {
			...baseItem("hero"),
			type: "simple",
		},
		"shared-raw": {
			...baseItem("shared-raw"),
			type: "simple",
		},
		"short-part-producer": producer({
			id: "short-part-producer",
			lines: [
				line({
					id: "line:short-part",
					inputItemId: "shared-raw",
					outputItemId: "short-part",
				}),
			],
		}),
		"short-target-producer": producer({
			id: "short-target-producer",
			lines: [
				line({
					id: "line:short-target",
					inputItemId: "short-part",
					inputQuantity: 2,
					outputItemId: "widened-target",
				}),
			],
		}),
		"detour-part-producer": producer({
			id: "detour-part-producer",
			lines: [
				line({
					id: "line:detour-part",
					inputItemId: "shared-raw",
					outputItemId: "detour-part",
				}),
			],
		}),
		"detour-middle-producer": producer({
			id: "detour-middle-producer",
			lines: [
				line({
					id: "line:detour-middle",
					inputItemId: "detour-part",
					outputItemId: "detour-middle",
				}),
			],
		}),
		"detour-target-producer": producer({
			id: "detour-target-producer",
			lines: [
				line({
					id: "line:detour-target",
					inputItemId: "detour-middle",
					outputItemId: "widened-target",
				}),
			],
		}),
		"short-part": {
			...baseItem("short-part"),
			type: "simple",
		},
		"detour-part": {
			...baseItem("detour-part"),
			type: "simple",
		},
		"detour-middle": {
			...baseItem("detour-middle"),
			type: "simple",
		},
		"widened-target": {
			...baseItem("widened-target"),
			type: "simple",
		},
	},
};

const config = GameConfigSchema.parse(configSource);
const makePlanner = () => Effect.runSync(createEnginePlannerFx(config));

describe("engine planner route widening", () => {
	it("restarts from the immutable root after a destructive shorter path", () => {
		const result = Effect.runSync(makePlanner().searchFx("widened-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.outputCertainty).toBe("deterministic");
		expect(result.elapsedMs).toBe(300);
		expect(result.expandedStates).toBe(5);
		expect(result.diagnostics).toMatchObject({
			attemptedRoutePlans: 2,
			winningRoutePlanIndex: 2,
		});
		expect(result.diagnostics.routePlans).toHaveLength(2);
		expect(result.diagnostics.routePlans[0]).toMatchObject({
			bestAvailableQuantity: 0,
			bestTraceActionIds: [
				'["line","short-part-producer","line:short-part"]',
			],
			depthDiscrepancy: 0,
			detours: [],
			expandedStates: 2,
			index: 1,
			maximumDetourDepth: 0,
			outcome: "search-exhausted",
		});
		expect(result.diagnostics.routePlans[1]).toMatchObject({
			bestAvailableQuantity: 1,
			bestTraceActionIds: [
				'["line","detour-part-producer","line:detour-part"]',
				'["line","detour-middle-producer","line:detour-middle"]',
				'["line","detour-target-producer","line:detour-target"]',
			],
			depthDiscrepancy: 1,
			detours: [
				expect.objectContaining({
					alternativeIndex: 1,
					depthExcess: 1,
					itemId: "widened-target",
					type: "acquisition-route",
				}),
			],
			expandedStates: 3,
			index: 2,
			maximumDetourDepth: 1,
			outcome: "completed",
		});
		expect(result.trace.map(({ action }) => action)).toEqual([
			{
				kind: "line",
				lineId: "line:detour-part",
				ownerItemId: "detour-part-producer",
			},
			{
				kind: "line",
				lineId: "line:detour-middle",
				ownerItemId: "detour-middle-producer",
			},
			{
				kind: "line",
				lineId: "line:detour-target",
				ownerItemId: "detour-target-producer",
			},
		]);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 3,
			expectedConsumedItems: [
				{
					itemId: "detour-middle",
					quantity: 1,
				},
				{
					itemId: "detour-part",
					quantity: 1,
				},
				{
					itemId: "shared-raw",
					quantity: 1,
				},
			],
			expectedElapsedMs: 300,
		});
	});

	it("does not widen after the global expanded-state budget is exhausted", () => {
		const result = Effect.runSync(
			makePlanner().searchFx("widened-target", 1, {
				maximumExpandedStates: 2,
			}),
		);

		expect(result).toMatchObject({
			bestAvailableQuantity: 0,
			budgetLimit: "maximumExpandedStates",
			expandedStates: 2,
			itemId: "widened-target",
			reason: "search-budget",
			trace: [
				{
					action: {
						kind: "line",
						lineId: "line:short-part",
						ownerItemId: "short-part-producer",
					},
				},
			],
			type: "inconclusive",
		});
		if (result.type !== "inconclusive") return;
		expect(result.diagnostics).toMatchObject({
			attemptedRoutePlans: 1,
			routePlans: [
				{
					bestAvailableQuantity: 0,
					bestTraceActionIds: [
						'["line","short-part-producer","line:short-part"]',
					],
					depthDiscrepancy: 0,
					detours: [],
					expandedStates: 2,
					index: 1,
					maximumDetourDepth: 0,
					outcome: "search-exhausted",
				},
			],
		});
		expect(result.diagnostics).not.toHaveProperty("winningRoutePlanIndex");
	});
});
