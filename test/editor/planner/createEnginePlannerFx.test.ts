import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEnginePlannerFx } from "~/editor/planner/createEnginePlannerFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const baseItem = ({
	id,
	maxStackSize = 10,
	scope = "any",
}: {
	readonly id: string;
	readonly maxStackSize?: number;
	readonly scope?: "any" | "board" | "inventory" | "toolbar";
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

const chanceOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					chance: 0.5,
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
					type: "chance" as const,
				},
			],
		},
	],
});

const mixedOutput = () => ({
	set: [
		{
			roll: [
				...guaranteedOutput("mixed-target").set[0].roll,
				...chanceOutput("mixed-bonus").set[0].roll,
			],
		},
	],
});

const mixedSameItemOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				...guaranteedOutput(itemId).set[0].roll,
				...chanceOutput(itemId).set[0].roll,
			],
		},
	],
});

const weightedOutput = () => ({
	set: [
		{
			roll: guaranteedOutput("weighted-decoy").set[0].roll,
			weight: 1,
		},
		{
			roll: [
				{
					drop: [
						{
							drop: [
								{
									itemId: "weighted-decoy",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							weight: 1,
						},
						{
							drop: [
								{
									itemId: "weighted-target",
									quantity: {
										max: 4,
										min: 2,
									},
									rules: [],
								},
								{
									itemId: "weighted-companion",
									quantity: {
										max: 2,
										min: 1,
									},
									rules: [],
								},
							],
							weight: 1,
						},
					],
					quantity: {
						max: 3,
						min: 2,
					},
					type: "weight" as const,
				},
			],
			weight: 3,
		},
	],
});

const materialInput = (itemId: string, quantity = 1, mode: "consume" | "reserve" = "consume") => ({
	capacity: quantity,
	mode,
	quantity: {
		max: quantity,
		min: quantity,
	},
	selector: {
		itemId,
		type: "item" as const,
	},
	type: "materials" as const,
});

const producerItem = ({
	id,
	additionalInputs = [],
	inputItemId,
	output,
	rules = [],
	runtimeMs,
}: {
	readonly additionalInputs?: ReadonlyArray<Record<string, unknown>>;
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
				...additionalInputs,
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

const boardItemIds = [
	"blocked-smelter",
	"smelter",
	"assembler",
	"random-producer",
	"mixed-producer",
	"mixed-same-item-producer",
	"weighted-producer",
	"parallel-producer-a",
	"parallel-producer-b",
	"parallel-assembler",
	"charge-worker",
	"charge-deposit",
	"charge-fuel-producer",
	"charged-producer",
	"temporary-token",
	"random-temporary-token",
	"temporary-inspector",
	"temporary-assembler",
	"merge-target",
	"start-target",
];

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:engine-planner-search",
		title: "Engine planner search",
		board: {
			height: 1,
			width: boardItemIds.length,
		},
		inventory: {
			height: 1,
			width: 4,
		},
	},
	start: {
		board: boardItemIds.map((itemId, x) => ({
			itemId,
			space: 0,
			x,
			y: 0,
		})),
		currentSpace: 0,
		inventory: [
			{
				itemId: "raw",
				quantity: 2,
			},
			{
				itemId: "catalyst",
				quantity: 1,
			},
			{
				itemId: "merge-source",
				quantity: 1,
			},
		],
	},
	items: {
		hero: simpleItem("hero"),
		raw: simpleItem("raw"),
		catalyst: simpleItem("catalyst"),
		"blocked-smelter": producerItem({
			id: "blocked-smelter",
			inputItemId: "catalyst",
			output: guaranteedOutput("ingot"),
			runtimeMs: 50,
		}),
		smelter: producerItem({
			id: "smelter",
			inputItemId: "raw",
			output: guaranteedOutput("ingot"),
			runtimeMs: 100,
		}),
		ingot: simpleItem("ingot"),
		assembler: producerItem({
			additionalInputs: [
				materialInput("catalyst", 1, "reserve"),
			],
			id: "assembler",
			inputItemId: "ingot",
			output: guaranteedOutput("target"),
			runtimeMs: 200,
		}),
		target: simpleItem("target"),
		"start-target": simpleItem("start-target"),
		"random-producer": producerItem({
			id: "random-producer",
			output: chanceOutput("random-target"),
			runtimeMs: 75,
		}),
		"random-target": simpleItem("random-target"),
		"mixed-producer": producerItem({
			id: "mixed-producer",
			output: mixedOutput(),
			runtimeMs: 80,
		}),
		"mixed-target": simpleItem("mixed-target"),
		"mixed-bonus": simpleItem("mixed-bonus"),
		"mixed-same-item-producer": producerItem({
			id: "mixed-same-item-producer",
			output: mixedSameItemOutput("mixed-same-item-target"),
			runtimeMs: 80,
		}),
		"mixed-same-item-target": simpleItem("mixed-same-item-target"),
		"weighted-producer": producerItem({
			id: "weighted-producer",
			output: weightedOutput(),
			runtimeMs: 90,
		}),
		"weighted-target": simpleItem("weighted-target"),
		"weighted-companion": simpleItem("weighted-companion"),
		"weighted-decoy": simpleItem("weighted-decoy"),
		"parallel-producer-a": producerItem({
			id: "parallel-producer-a",
			output: guaranteedOutput("parallel-part"),
			runtimeMs: 10,
		}),
		"parallel-producer-b": producerItem({
			id: "parallel-producer-b",
			output: guaranteedOutput("parallel-part"),
			runtimeMs: 10,
		}),
		"parallel-part": simpleItem("parallel-part"),
		"parallel-assembler": producerItem({
			id: "parallel-assembler",
			inputItemId: "parallel-part",
			output: guaranteedOutput("parallel-target"),
			runtimeMs: 20,
		}),
		"parallel-target": simpleItem("parallel-target"),
		"charge-worker": {
			...baseItem({
				id: "charge-worker",
				maxStackSize: 1,
				scope: "board",
			}),
			lines: [
				{
					description: "Spend one charge from a nearby deposit.",
					id: "line:charge-worker:spend",
					input: [
						{
							charges: {
								cost: 1,
								from: "target",
							},
							query: {
								distance: "near",
								scope: "board",
								selector: {
									itemId: "charge-deposit",
									type: "item",
								},
							},
							type: "deposit",
						},
					],
					rules: [],
					runtimeMs: 40,
					title: "Spend",
				},
			],
			maxQueueSize: 1,
			type: "producer",
		},
		"charge-deposit": {
			...baseItem({
				id: "charge-deposit",
				maxStackSize: 1,
				scope: "board",
			}),
			charges: {
				amount: 3,
				output: chanceOutput("charge-target"),
			},
			type: "deposit",
		},
		"charge-target": simpleItem("charge-target"),
		"charge-fuel-producer": producerItem({
			id: "charge-fuel-producer",
			output: guaranteedOutput("charge-fuel"),
			runtimeMs: 10,
		}),
		"charge-fuel": simpleItem("charge-fuel"),
		"charged-producer": {
			...producerItem({
				additionalInputs: [
					{
						...materialInput("charge-fuel"),
						charges: {
							cost: 1,
							from: "self",
						},
					},
				],
				id: "charged-producer",
				output: guaranteedOutput("charged-side-output"),
				runtimeMs: 40,
			}),
			charges: {
				amount: 3,
				output: guaranteedOutput("depleted-target"),
			},
		},
		"charged-side-output": simpleItem("charged-side-output"),
		"depleted-target": simpleItem("depleted-target"),
		"temporary-token": {
			...baseItem({
				id: "temporary-token",
				maxStackSize: 1,
				scope: "board",
			}),
			durationMs: 500,
			output: guaranteedOutput("temporary-shell"),
			type: "temporary",
		},
		"temporary-shell": simpleItem("temporary-shell"),
		"random-temporary-token": {
			...baseItem({
				id: "random-temporary-token",
				maxStackSize: 1,
				scope: "board",
			}),
			durationMs: 500,
			output: chanceOutput("random-temporary-target"),
			type: "temporary",
		},
		"random-temporary-target": simpleItem("random-temporary-target"),
		"temporary-inspector": producerItem({
			id: "temporary-inspector",
			output: guaranteedOutput("temporary-proof"),
			rules: [
				{
					type: "enable",
					when: [
						{
							query: {
								distance: "near",
								scope: "board",
								selector: {
									itemId: "temporary-token",
									type: "item",
								},
							},
							type: "exists",
						},
					],
				},
			],
			runtimeMs: 50,
		}),
		"temporary-proof": simpleItem("temporary-proof"),
		"temporary-assembler": producerItem({
			additionalInputs: [
				materialInput("temporary-shell"),
			],
			id: "temporary-assembler",
			inputItemId: "temporary-proof",
			output: guaranteedOutput("temporary-target"),
			runtimeMs: 60,
		}),
		"temporary-target": simpleItem("temporary-target"),
		orphan: simpleItem("orphan"),
		"merge-source": {
			...simpleItem("merge-source"),
			merge: [
				{
					action: "consume",
					effect: "replace",
					result: "merge-result",
					target: {
						itemId: "merge-target",
						type: "item",
					},
				},
			],
		},
		"merge-target": simpleItem("merge-target"),
		"merge-result": simpleItem("merge-result"),
	},
});

const infrastructureConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:engine-planner-infrastructure-economics",
		title: "Engine planner infrastructure economics",
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
				itemId: "machine-builder",
				space: 0,
				x: 0,
				y: 0,
			},
		],
		currentSpace: 0,
		inventory: [
			{
				itemId: "machine-kit",
				quantity: 1,
			},
		],
	},
	items: {
		hero: simpleItem("hero"),
		"machine-kit": simpleItem("machine-kit"),
		"machine-builder": producerItem({
			id: "machine-builder",
			inputItemId: "machine-kit",
			output: guaranteedOutput("built-machine"),
			runtimeMs: 100,
		}),
		"built-machine": producerItem({
			id: "built-machine",
			output: guaranteedOutput("built-target"),
			runtimeMs: 50,
		}),
		"built-target": simpleItem("built-target"),
	},
});

const makePlanner = () => Effect.runSync(createEnginePlannerFx(config));

describe("createEnginePlannerFx", () => {
	it("includes produced retained infrastructure in selected-trace economics", () => {
		const planner = Effect.runSync(createEnginePlannerFx(infrastructureConfig));
		const result = Effect.runSync(planner.searchFx("built-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(150);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 2,
			expectedConsumedItems: [
				{
					itemId: "machine-kit",
					quantity: 1,
				},
			],
			expectedElapsedMs: 150,
			observedActionRuns: 2,
			observedElapsedMs: 150,
		});
		expect(result.economics.operations).toMatchObject([
			{
				actionId: '["line","machine-builder","line:machine-builder:run"]',
				expectedRuns: 1,
			},
			{
				actionId: '["line","built-machine","line:built-machine:run"]',
				expectedRuns: 1,
			},
		]);
	});

	it("records exact authored output distributions separately from existential witnesses", () => {
		const planner = makePlanner();
		const chance = planner.graph.routesByOutputItemId.get("random-target")?.[0];
		const guaranteed = planner.graph.routesByOutputItemId.get("mixed-target")?.[0];
		const weighted = planner.graph.routesByOutputItemId.get("weighted-target")?.[0];
		const companion = planner.graph.routesByOutputItemId.get("weighted-companion")?.[0];

		expect(chance?.output).toMatchObject({
			expectedQuantity: 0.5,
			maximumQuantity: 1,
			maximumQuantityProbability: 0.5,
			occurrenceProbability: 0.5,
			quantityDistribution: [
				{
					probability: 0.5,
					quantity: 0,
				},
				{
					probability: 0.5,
					quantity: 1,
				},
			],
			stochastic: true,
		});
		expect(guaranteed?.output).toMatchObject({
			expectedQuantity: 1,
			maximumQuantityProbability: 1,
			occurrenceProbability: 1,
			quantityDistribution: [
				{
					probability: 1,
					quantity: 1,
				},
			],
			stochastic: false,
		});
		expect(weighted?.output.expectedQuantity).toBeCloseTo(45 / 16);
		expect(weighted?.output.maximumQuantity).toBe(12);
		expect(weighted?.output.maximumQuantityProbability).toBeCloseTo(1 / 576);
		expect(weighted?.output.occurrenceProbability).toBeCloseTo(39 / 64);
		expect(
			weighted?.output.quantityDistribution.reduce(
				(total, entry) => total + entry.probability,
				0,
			),
		).toBeCloseTo(1);
		expect(companion?.output.expectedQuantity).toBeCloseTo(45 / 32);
		expect(companion?.output.maximumQuantity).toBe(6);
	});

	it("backtracks from a shorter destructive alternative through the real engine", () => {
		const planner = makePlanner();
		const initial = structuredClone(planner.initialRuntime);
		const result = Effect.runSync(planner.searchFx("target"));

		expect(planner.initialRuntime).toEqual(initial);
		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.availableQuantity).toBe(1);
		expect(result.elapsedMs).toBe(300);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 2,
			expectedConsumedItems: [
				{
					itemId: "ingot",
					quantity: 1,
				},
				{
					itemId: "raw",
					quantity: 1,
				},
			],
			expectedElapsedMs: 300,
			method: "selected-trace-replay",
			observedActionRuns: 2,
			observedElapsedMs: 300,
			totalExpectedConsumedQuantity: 2,
		});
		expect(result.economics.operations).toMatchObject([
			{
				actionId: '["line","smelter","line:smelter:run"]',
				expectedElapsedMs: 100,
				expectedRuns: 1,
				observedRuns: 1,
			},
			{
				actionId: '["line","assembler","line:assembler:run"]',
				expectedElapsedMs: 200,
				expectedRuns: 1,
				observedRuns: 1,
			},
		]);
		expect(result.trace.map(({ action }) => action)).toEqual([
			{
				kind: "line",
				lineId: "line:smelter:run",
				ownerItemId: "smelter",
			},
			{
				kind: "line",
				lineId: "line:assembler:run",
				ownerItemId: "assembler",
			},
		]);
		expect(
			result.trace.map(({ consumedItemQuantities, producedItemQuantities }) => ({
				consumedItemQuantities,
				producedItemQuantities,
			})),
		).toEqual([
			{
				consumedItemQuantities: [
					{
						itemId: "raw",
						quantity: 1,
					},
				],
				producedItemQuantities: [
					{
						itemId: "ingot",
						quantity: 1,
					},
				],
			},
			{
				consumedItemQuantities: [
					{
						itemId: "ingot",
						quantity: 1,
					},
				],
				producedItemQuantities: [
					{
						itemId: "target",
						quantity: 1,
					},
				],
			},
		]);
		expect(result.trace.flatMap(({ events }) => events.map(({ type }) => type))).toEqual(
			expect.arrayContaining([
				GameEventEnumSchema.enum.ItemConsumed,
				GameEventEnumSchema.enum.JobStarted,
				GameEventEnumSchema.enum.JobCompleted,
			]),
		);
		expect(result.runtime.items.some(({ item }) => item.id === "raw")).toBe(true);
		expect(result.runtime.items.some(({ item }) => item.id === "ingot")).toBe(false);
		expect(result.runtime.items.some(({ item }) => item.id === "target")).toBe(true);
		expect(
			result.runtime.items.reduce(
				(total, item) => total + (item.item.id === "catalyst" ? item.quantity : 0),
				0,
			),
		).toBe(1);
		expect(
			result.runtime.items.some(
				(item) =>
					item.item.id === "target" &&
					item.location.scope === "board" &&
					item.location.position.x >= config.meta.board.width,
			),
		).toBe(true);
	});

	it("repeats canonical production until the requested quantity exists", () => {
		const result = Effect.runSync(makePlanner().searchFx("target", 2));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.availableQuantity).toBe(2);
		expect(result.elapsedMs).toBe(600);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 4,
			expectedConsumedItems: [
				{
					itemId: "ingot",
					quantity: 2,
				},
				{
					itemId: "raw",
					quantity: 2,
				},
			],
			expectedElapsedMs: 600,
			expectedSpentCharges: [],
			requiredAdditionalTargetQuantity: 2,
		});
		expect(result.trace).toHaveLength(4);
		expect(
			result.runtime.items.reduce(
				(total, item) => total + (item.item.id === "target" ? item.quantity : 0),
				0,
			),
		).toBe(2);
		expect(result.runtime.items.some(({ item }) => item.id === "raw")).toBe(false);
	});

	it("executes a deterministic merge through the canonical merge transition", () => {
		const result = Effect.runSync(makePlanner().searchFx("merge-result"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(0);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 1,
			expectedConsumedItems: [
				{
					itemId: "merge-source",
					quantity: 1,
				},
				{
					itemId: "merge-target",
					quantity: 1,
				},
			],
			expectedElapsedMs: 0,
		});
		expect(result.trace).toHaveLength(1);
		expect(result.trace[0]?.action).toEqual({
			kind: "merge",
			mergeIndex: 0,
			sourceItemId: "merge-source",
			targetItemId: "merge-target",
		});
		expect(result.runtime.items.some(({ item }) => item.id === "merge-result")).toBe(true);
		expect(result.runtime.items.some(({ item }) => item.id === "merge-source")).toBe(false);
		expect(result.runtime.items.some(({ item }) => item.id === "merge-target")).toBe(false);
	});

	it("collapses branches whose engine runtime differs only by generated identities", () => {
		const result = Effect.runSync(makePlanner().searchFx("parallel-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.expandedStates).toBe(2);
		expect(result.visitedStates).toBe(3);
		expect(result.trace.map(({ action }) => action)).toEqual([
			{
				kind: "line",
				lineId: "line:parallel-producer-a:run",
				ownerItemId: "parallel-producer-a",
			},
			{
				kind: "line",
				lineId: "line:parallel-assembler:run",
				ownerItemId: "parallel-assembler",
			},
		]);
	});

	it("repeats a real spender line until stochastic charge depletion resolves", () => {
		const result = Effect.runSync(makePlanner().searchFx("charge-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(120);
		expect(result.outputCertainty).toBe("possible");
		expect(result.selectedWitnessProbability).toBe(0.5);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 6,
			expectedConsumedItems: [
				{
					itemId: "charge-deposit",
					quantity: 2,
				},
			],
			expectedElapsedMs: 240,
			expectedSpentCharges: [
				{
					charges: 6,
					itemId: "charge-deposit",
				},
			],
			observedActionRuns: 3,
			observedElapsedMs: 120,
		});
		expect(result.trace.map(({ action }) => action)).toEqual(
			Array.from(
				{
					length: 3,
				},
				() => ({
					kind: "line" as const,
					lineId: "line:charge-worker:spend",
					ownerItemId: "charge-worker",
				}),
			),
		);
		expect(result.trace.map(({ outputResolution }) => outputResolution.type)).toEqual([
			"canonical",
			"canonical",
			"existential",
		]);
		expect(result.trace[2]?.outputResolution).toMatchObject({
			outputItemId: "charge-target",
			type: "existential",
		});
		expect(result.trace.map(({ consumedItemQuantities }) => consumedItemQuantities)).toEqual([
			[],
			[],
			[
				{
					itemId: "charge-deposit",
					quantity: 1,
				},
			],
		]);
		const eventTypes = result.trace.flatMap(({ events }) => events.map(({ type }) => type));
		expect(
			eventTypes.filter((type) => type === GameEventEnumSchema.enum.ItemChargeSpent),
		).toHaveLength(2);
		expect(
			eventTypes.filter((type) => type === GameEventEnumSchema.enum.ItemDepleted),
		).toHaveLength(1);
		expect(result.runtime.items.some(({ item }) => item.id === "charge-deposit")).toBe(false);
		expect(result.runtime.items.some(({ item }) => item.id === "charge-worker")).toBe(true);
		expect(result.runtime.items.some(({ item }) => item.id === "charge-target")).toBe(true);
	});

	it("uses a temporary item before explicitly expiring it", () => {
		const result = Effect.runSync(makePlanner().searchFx("temporary-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(610);
		expect(result.outputCertainty).toBe("deterministic");
		expect(result.trace.map(({ action }) => action)).toEqual([
			{
				kind: "line",
				lineId: "line:temporary-inspector:run",
				ownerItemId: "temporary-inspector",
			},
			{
				itemId: "temporary-token",
				kind: "temporary-expiry",
			},
			{
				kind: "line",
				lineId: "line:temporary-assembler:run",
				ownerItemId: "temporary-assembler",
			},
		]);
		expect(result.trace[1]).toMatchObject({
			consumedItemQuantities: [
				{
					itemId: "temporary-token",
					quantity: 1,
				},
			],
			producedItemQuantities: [
				{
					itemId: "temporary-shell",
					quantity: 1,
				},
			],
		});
		expect(result.runtime.items.some(({ item }) => item.id === "temporary-token")).toBe(false);
		expect(result.runtime.items.some(({ item }) => item.id === "temporary-target")).toBe(true);
	});

	it("resolves a stochastic temporary expiry as a possible witness", () => {
		const result = Effect.runSync(makePlanner().searchFx("random-temporary-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(500);
		expect(result.outputCertainty).toBe("possible");
		expect(result.selectedWitnessProbability).toBe(0.5);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 2,
			expectedConsumedItems: [
				{
					itemId: "random-temporary-token",
					quantity: 2,
				},
			],
			expectedElapsedMs: 1_000,
		});
		expect(result.trace).toHaveLength(1);
		expect(result.trace[0]).toMatchObject({
			action: {
				itemId: "random-temporary-token",
				kind: "temporary-expiry",
			},
			outputResolution: {
				outputItemId: "random-temporary-target",
				type: "existential",
			},
		});
		expect(result.runtime.items.some(({ item }) => item.id === "random-temporary-token")).toBe(
			false,
		);
		expect(result.runtime.items.some(({ item }) => item.id === "random-temporary-target")).toBe(
			true,
		);
	});

	it("reports a non-terminal charge spend before the charged item is consumed", () => {
		const result = Effect.runSync(makePlanner().searchFx("charged-side-output"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.economics).toMatchObject({
			expectedActionRuns: 2,
			expectedConsumedItems: [
				{
					itemId: "charge-fuel",
					quantity: 1,
				},
			],
			expectedElapsedMs: 50,
			expectedSpentCharges: [
				{
					charges: 1,
					itemId: "charged-producer",
				},
			],
			totalExpectedSpentCharges: 1,
		});
		expect(result.runtime.items.some(({ item }) => item.id === "charged-producer")).toBe(true);
	});

	it("replenishes consumed fuel while progressing a charged owner toward depletion", () => {
		const result = Effect.runSync(makePlanner().searchFx("depleted-target"));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(150);
		expect(result.outputCertainty).toBe("deterministic");
		expect(result.economics).toMatchObject({
			expectedActionRuns: 6,
			expectedConsumedItems: [
				{
					itemId: "charge-fuel",
					quantity: 3,
				},
				{
					itemId: "charged-producer",
					quantity: 1,
				},
			],
			expectedElapsedMs: 150,
			expectedSpentCharges: [
				{
					charges: 3,
					itemId: "charged-producer",
				},
			],
		});
		expect(result.trace.map(({ action }) => action)).toEqual(
			Array.from(
				{
					length: 3,
				},
				() => [
					{
						kind: "line" as const,
						lineId: "line:charge-fuel-producer:run",
						ownerItemId: "charge-fuel-producer",
					},
					{
						kind: "line" as const,
						lineId: "line:charged-producer:run",
						ownerItemId: "charged-producer",
					},
				],
			).flat(),
		);
		const eventTypes = result.trace.flatMap(({ events }) => events.map(({ type }) => type));
		expect(
			eventTypes.filter((type) => type === GameEventEnumSchema.enum.ItemChargeSpent),
		).toHaveLength(2);
		expect(
			eventTypes.filter((type) => type === GameEventEnumSchema.enum.ItemDepleted),
		).toHaveLength(1);
		expect(result.runtime.items.some(({ item }) => item.id === "charged-producer")).toBe(false);
		expect(result.runtime.items.some(({ item }) => item.id === "charge-fuel")).toBe(false);
		expect(
			result.runtime.items.reduce(
				(total, item) =>
					total + (item.item.id === "charged-side-output" ? item.quantity : 0),
				0,
			),
		).toBe(3);
		expect(result.runtime.items.some(({ item }) => item.id === "depleted-target")).toBe(true);
	});

	it("returns an already-owned start target without running an action", () => {
		const result = Effect.runSync(makePlanner().searchFx("start-target"));

		expect(result).toMatchObject({
			availableQuantity: 1,
			economics: {
				expectedActionRuns: 0,
				expectedConsumedItems: [],
				expectedElapsedMs: 0,
				expectedSpentCharges: [],
				initialTargetQuantity: 1,
				observedActionRuns: 0,
				operations: [],
				requiredAdditionalTargetQuantity: 0,
				totalExpectedSpentCharges: 0,
			},
			elapsedMs: 0,
			expandedStates: 0,
			itemId: "start-target",
			quantity: 1,
			selectedWitnessProbability: 1,
			trace: [],
			type: "completed",
		});
	});

	it("uses graph proof only for structurally unreachable targets", () => {
		const orphan = Effect.runSync(makePlanner().searchFx("orphan"));
		const missing = Effect.runSync(makePlanner().searchFx("missing-item"));

		expect(orphan).toMatchObject({
			itemId: "orphan",
			proof: {
				type: "no-finite-path",
			},
			type: "no-finite-path",
		});
		expect(missing).toEqual({
			diagnostics: {
				attemptedRoutePlans: 0,
				routePlans: [],
			},
			itemId: "missing-item",
			proof: {
				itemId: "missing-item",
				type: "target-missing",
			},
			quantity: 1,
			type: "no-finite-path",
		});
	});

	it("executes a stochastic output as an explicit possible witness", () => {
		const result = Effect.runSync(makePlanner().searchFx("random-target"));

		expect(result).toMatchObject({
			availableQuantity: 1,
			economics: {
				expectedActionRuns: 2,
				expectedElapsedMs: 150,
			},
			expandedStates: 1,
			itemId: "random-target",
			outputCertainty: "possible",
			selectedWitnessProbability: 0.5,
			type: "completed",
			trace: [
				{
					outputResolution: {
						outputItemId: "random-target",
						statistics: {
							expectedQuantity: 0.5,
							maximumQuantity: 1,
							maximumQuantityProbability: 0.5,
							occurrenceProbability: 0.5,
						},
						type: "existential",
					},
				},
			],
		});
	});

	it("keeps a guaranteed output canonical even when the same action has a chance sibling", () => {
		const result = Effect.runSync(makePlanner().searchFx("mixed-target"));

		expect(result).toMatchObject({
			availableQuantity: 1,
			itemId: "mixed-target",
			outputCertainty: "deterministic",
			type: "completed",
			trace: [
				{
					outputResolution: {
						type: "canonical",
					},
				},
			],
		});
	});

	it("includes a guaranteed same-item baseline in stochastic replay economics", () => {
		const result = Effect.runSync(makePlanner().searchFx("mixed-same-item-target", 2));

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.trace).toHaveLength(1);
		expect(result.trace[0]?.outputResolution.type).toBe("existential");
		expect(result.economics.observedActionRuns).toBe(1);
		expect(result.economics.expectedActionRuns).toBeCloseTo(1.5);
		expect(result.economics.expectedElapsedMs).toBeCloseTo(120);
	});

	it("realizes a weighted alternative-set witness with correlated integer drops", () => {
		const result = Effect.runSync(makePlanner().searchFx("weighted-target", 12));

		expect(result).toMatchObject({
			availableQuantity: 12,
			elapsedMs: 90,
			itemId: "weighted-target",
			outputCertainty: "possible",
			type: "completed",
			trace: [
				{
					outputResolution: {
						outputItemId: "weighted-target",
						type: "existential",
					},
				},
			],
		});
		if (result.type !== "completed") return;
		expect(result.selectedWitnessProbability).toBeCloseTo(1 / 576);
		expect(result.economics.expectedActionRuns).toBeCloseTo(5.088_627_678_564_287);
		expect(result.economics.expectedElapsedMs).toBeCloseTo(457.976_491_070_785_8);
		expect(
			result.runtime.items.reduce(
				(total, item) =>
					total + (item.item.id === "weighted-companion" ? item.quantity : 0),
				0,
			),
		).toBe(6);
		expect(result.runtime.items.some(({ item }) => item.id === "weighted-decoy")).toBe(false);
	});

	it("does not turn an insufficient root quantity into structural impossibility", () => {
		const result = Effect.runSync(makePlanner().searchFx("start-target", 2));

		expect(result).toMatchObject({
			bestAvailableQuantity: 1,
			itemId: "start-target",
			reason: "search-exhausted",
			type: "inconclusive",
		});
	});

	it("reports the expanded-state budget without forging impossibility", () => {
		const result = Effect.runSync(
			makePlanner().searchFx("target", 1, {
				maximumExpandedStates: 1,
			}),
		);

		expect(result).toMatchObject({
			budgetLimit: "maximumExpandedStates",
			itemId: "target",
			reason: "search-budget",
			type: "inconclusive",
		});
	});

	it("keeps searching inside a one-state bounded frontier", () => {
		const result = Effect.runSync(
			makePlanner().searchFx("target", 1, {
				maximumQueuedStates: 1,
			}),
		);

		expect(result).toMatchObject({
			availableQuantity: 1,
			itemId: "target",
			type: "completed",
		});
	});

	it("reports a bounded search as inconclusive without forging impossibility", () => {
		const result = Effect.runSync(
			makePlanner().searchFx("target", 1, {
				maximumTraceLength: 1,
			}),
		);

		expect(result).toMatchObject({
			budgetLimit: "maximumTraceLength",
			itemId: "target",
			reason: "search-budget",
			type: "inconclusive",
		});
	});

	it("executes an official chance output as a possible engine witness", async () => {
		const official = await readArkiniGameConfigSource();
		const planner = Effect.runSync(createEnginePlannerFx(official));
		const result = await Effect.runPromise(planner.searchFx("item:quest:road-repair"));

		expect(result).toMatchObject({
			availableQuantity: 1,
			expandedStates: 1,
			itemId: "item:quest:road-repair",
			outputCertainty: "possible",
			type: "completed",
			trace: [
				{
					action: {
						kind: "line",
						lineId: "line:lumberjack-t1:log",
						ownerItemId: "producer:lumberjack-t1",
					},
					outputResolution: {
						outputItemId: "item:quest:road-repair",
						type: "existential",
					},
				},
			],
		});
	});

	it("depletes an official tree through eighteen real lumberjack jobs", async () => {
		const official = await readArkiniGameConfigSource();
		const planner = Effect.runSync(createEnginePlannerFx(official));
		const result = await Effect.runPromise(
			planner.searchFx("item:seed", 1, {
				maximumExpandedStates: 32,
				maximumQueuedStates: 64,
				maximumTraceLength: 24,
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.elapsedMs).toBe(126_000);
		expect(result.outputCertainty).toBe("deterministic");
		expect(result.trace).toHaveLength(18);
		expect(result.economics).toMatchObject({
			expectedActionRuns: 18,
			expectedConsumedItems: [
				{
					itemId: "item:tree",
					quantity: 1,
				},
			],
			expectedElapsedMs: 126_000,
			expectedSpentCharges: [
				{
					charges: 18,
					itemId: "item:tree",
				},
			],
		});
		expect(
			result.trace.every(
				({ action }) =>
					action.kind === "line" &&
					action.lineId === "line:lumberjack-t1:log" &&
					action.ownerItemId === "producer:lumberjack-t1",
			),
		).toBe(true);
		expect(
			result.trace
				.flatMap(({ events }) => events)
				.filter(({ type }) => type === GameEventEnumSchema.enum.ItemDepleted),
		).toHaveLength(1);
		expect(result.runtime.items.some(({ item }) => item.id === "item:seed")).toBe(true);
	});

	it("prioritizes active official demands through the well chain", async () => {
		const official = await readArkiniGameConfigSource();
		const planner = Effect.runSync(createEnginePlannerFx(official));
		const result = await Effect.runPromise(
			planner.searchFx("item:double-tree", 1, {
				maximumExpandedStates: 64,
				maximumQueuedStates: 128,
				maximumTraceLength: 16,
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.expandedStates).toBeLessThan(20);
		expect(result.outputCertainty).toBe("possible");
		expect(result.trace.map(({ action }) => action)).toEqual([
			{
				kind: "line",
				lineId: "line:lumberjack-t1:log",
				ownerItemId: "producer:lumberjack-t1",
			},
			{
				kind: "line",
				lineId: "line:quarry-t1:stone",
				ownerItemId: "producer:quarry-t1",
			},
			{
				kind: "line",
				lineId: "line:townhall-t1:blueprint-well-t1",
				ownerItemId: "producer:townhall-t1",
			},
			{
				kind: "line",
				lineId: "line:lumberjack-t1:log",
				ownerItemId: "producer:lumberjack-t1",
			},
			{
				kind: "line",
				lineId: "line:quarry-t1:stone",
				ownerItemId: "producer:quarry-t1",
			},
			{
				kind: "line",
				lineId: "line:blueprint:well-t1:construct",
				ownerItemId: "item:blueprint-well-t1",
			},
			{
				kind: "line",
				lineId: "line:well-t1:water",
				ownerItemId: "producer:well-t1",
			},
			{
				kind: "merge",
				mergeIndex: 0,
				sourceItemId: "item:water",
				targetItemId: "item:tree",
			},
		]);
		expect(result.economics.expectedActionRuns).toBeCloseTo(8.6);
		expect(result.economics.expectedElapsedMs).toBeCloseTo(55_800);
		expect(result.economics.operations).toContainEqual(
			expect.objectContaining({
				actionId: '["line","item:blueprint-well-t1","line:blueprint:well-t1:construct"]',
				expectedRuns: 1,
			}),
		);
		expect(result.runtime.items.some(({ item }) => item.id === "item:double-tree")).toBe(true);
	});
});
