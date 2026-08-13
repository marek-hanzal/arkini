import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createEngineBackedEditorItemSimulatorFx } from "~/editor/simulator/createEngineBackedEditorItemSimulatorFx";
import { createLegacyEditorItemSimulatorFx } from "~test/editor/support/createLegacyEditorItemSimulatorFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { GameConfigSchema as GameConfigSchemaValue } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const baseItem = ({
	id,
	maxStackSize = 10,
	scope = "any",
}: {
	readonly id: string;
	readonly maxStackSize?: number;
	readonly scope?: "any" | "board";
}) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize,
	scope,
	title: id,
	uid: id,
});

const simpleItem = (id: string) => ({
	...baseItem({
		id,
	}),
	type: "simple" as const,
});

const drop = (itemId: string) => ({
	itemId,
	quantity: {
		max: 1,
		min: 1,
	},
	rules: [],
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					drop: [
						drop(itemId),
					],
					type: "guaranteed" as const,
				},
			],
		},
	],
});

const materialInput = (itemId: string) => ({
	capacity: 1,
	mode: "consume" as const,
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

const producerItem = ({
	id,
	inputItemId,
	output,
	rules = [],
	runtimeMs,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly output: Record<string, unknown>;
	readonly rules?: ReadonlyArray<Record<string, unknown>>;
	readonly runtimeMs: number;
}) => ({
	...baseItem({
		id,
		maxStackSize: 1,
		scope: "board",
	}),
	lines: [
		{
			description: `${id} line`,
			id: `line:${id}:run`,
			input: [
				...(inputItemId === undefined
					? [
							{
								type: "simple" as const,
							},
						]
					: [
							materialInput(inputItemId),
						]),
			],
			output,
			rules,
			runtimeMs,
			title: "Run",
		},
	],
	maxQueueSize: 1,
	type: "producer" as const,
});

const parityConfig = GameConfigSchemaValue.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:editor-estimator-parity",
		title: "Editor estimator parity",
		board: {
			height: 1,
			width: 7,
		},
		inventory: {
			height: 1,
			width: 1,
		},
	},
	start: {
		board: [
			"deterministic-producer",
			"mixed-producer",
			"disabled-producer",
			"blocker",
			"step-a",
			"step-b",
		].map((itemId, x) => ({
			itemId,
			space: 0,
			x,
			y: 0,
		})),
		currentSpace: 0,
		inventory: [
			{
				itemId: "raw",
				quantity: 1,
			},
		],
	},
	items: {
		hero: simpleItem("hero"),
		raw: simpleItem("raw"),
		"deterministic-producer": producerItem({
			id: "deterministic-producer",
			inputItemId: "raw",
			output: guaranteedOutput("deterministic-target"),
			runtimeMs: 100,
		}),
		"deterministic-target": simpleItem("deterministic-target"),
		"mixed-producer": producerItem({
			id: "mixed-producer",
			output: {
				set: [
					{
						roll: [
							{
								drop: [
									drop("mixed-target"),
								],
								type: "guaranteed",
							},
							{
								chance: 0.5,
								drop: [
									drop("mixed-target"),
								],
								type: "chance",
							},
						],
					},
				],
			},
			runtimeMs: 80,
		}),
		"mixed-target": simpleItem("mixed-target"),
		blocker: simpleItem("blocker"),
		"disabled-producer": producerItem({
			id: "disabled-producer",
			output: guaranteedOutput("disabled-target"),
			rules: [
				{
					type: "disable",
					when: [
						{
							query: {
								scope: "universe",
								selector: {
									itemId: "blocker",
									type: "item",
								},
							},
							type: "exists",
						},
					],
				},
			],
			runtimeMs: 10,
		}),
		"disabled-target": simpleItem("disabled-target"),
		"step-a": producerItem({
			id: "step-a",
			output: guaranteedOutput("intermediate"),
			runtimeMs: 10,
		}),
		intermediate: simpleItem("intermediate"),
		"step-b": producerItem({
			id: "step-b",
			inputItemId: "intermediate",
			output: guaranteedOutput("bounded-target"),
			runtimeMs: 20,
		}),
		"bounded-target": simpleItem("bounded-target"),
		orphan: simpleItem("orphan"),
	},
});

const readParity = (
	config: GameConfigSchema.Type,
	itemId: string,
	quantity = 1,
	budget?: Partial<PlannerSearchBudget>,
) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const legacy = yield* createLegacyEditorItemSimulatorFx(config);
			const planner = yield* createEngineBackedEditorItemSimulatorFx(config);
			return {
				legacy: yield* legacy.simulateFx(itemId, quantity),
				planner: yield* planner.simulateFx(itemId, quantity, budget),
			};
		}),
	);

describe("legacy/editor engine planner parity boundaries", () => {
	it("keeps exact deterministic economics where the legacy oracle was already correct", async () => {
		const { legacy, planner } = await readParity(parityConfig, "deterministic-target");

		expect(planner.status).toBe("estimated");
		expect(planner.runtimeMs).toBe(legacy.runtimeMs);
		expect(planner.cost).toEqual(legacy.cost);
		const withoutGeneratedId = ({
			id: _id,
			...operation
		}: (typeof planner.operations)[number]) => operation;
		expect(planner.operations.map(withoutGeneratedId)).toEqual(
			legacy.operations.map(withoutGeneratedId),
		);
	});

	it("uses exact hitting-time economics instead of legacy mean-yield division", async () => {
		const { legacy, planner } = await readParity(parityConfig, "mixed-target", 2);

		expect(legacy.status).toBe("estimated");
		expect(planner.status).toBe("estimated");
		expect(legacy.runtimeMs).toBe(160);
		expect(planner.runtimeMs).toBeCloseTo(120);
		expect(planner.planner).toMatchObject({
			expectedActionRuns: 1.5,
			observedActionRuns: 1,
			outputCertainty: "possible",
			type: "completed",
		});
	});

	it("does not inherit an unproven legacy impossibility claim", async () => {
		const { legacy, planner } = await readParity(parityConfig, "disabled-target");

		expect(legacy.status).toBe("no-finite-path");
		expect(planner).toMatchObject({
			planner: {
				reason: "search-exhausted",
				type: "inconclusive",
			},
			status: "inconclusive",
		});
	});

	it("keeps a deliberately bounded valid path inconclusive instead of forging impossibility", async () => {
		const { legacy, planner } = await readParity(parityConfig, "bounded-target", 1, {
			maximumExpandedStates: 1,
		});

		expect(legacy.status).toBe("estimated");
		expect(planner).toMatchObject({
			planner: {
				budgetLimit: "maximumExpandedStates",
				reason: "search-budget",
				type: "inconclusive",
			},
			status: "inconclusive",
		});
	});

	it("agrees on graph-certified structural impossibility", async () => {
		const { legacy, planner } = await readParity(parityConfig, "orphan");

		expect(legacy.status).toBe("no-finite-path");
		expect(planner).toMatchObject({
			planner: {
				proofType: "no-finite-path",
				type: "no-finite-path",
			},
			status: "no-finite-path",
		});
	});

	it("classifies the official well chain as expected-economics refinement", async () => {
		const config = await readArkiniGameConfigSource();
		const { legacy, planner } = await readParity(config, "item:water");

		expect(legacy.status).toBe("estimated");
		expect(legacy.runtimeMs).toBe(51_000);
		expect(planner.status).toBe("estimated");
		expect(planner.runtimeMs).toBeCloseTo(55_800);
		expect(planner.planner).toMatchObject({
			expectedActionRuns: 7.6,
			observedActionRuns: 7,
			observedRuntimeMs: 51_000,
			outputCertainty: "possible",
			type: "completed",
		});
		expect(planner.operations).toContainEqual(
			expect.objectContaining({
				lineId: "line:blueprint:well-t1:construct",
				runs: 1,
			}),
		);
	});
});
