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
	runtimeMs,
}: {
	readonly additionalInputs?: ReadonlyArray<Record<string, unknown>>;
	readonly id: string;
	readonly inputItemId?: string;
	readonly output: Record<string, unknown>;
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
			rules: [],
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
	"weighted-producer",
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
		"weighted-producer": producerItem({
			id: "weighted-producer",
			output: weightedOutput(),
			runtimeMs: 90,
		}),
		"weighted-target": simpleItem("weighted-target"),
		"weighted-companion": simpleItem("weighted-companion"),
		"weighted-decoy": simpleItem("weighted-decoy"),
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

const makePlanner = () => Effect.runSync(createEnginePlannerFx(config));

describe("createEnginePlannerFx", () => {
	it("backtracks from a shorter destructive alternative through the real engine", () => {
		const planner = makePlanner();
		const initial = structuredClone(planner.initialRuntime);
		const result = Effect.runSync(planner.searchFx("target"));

		expect(planner.initialRuntime).toEqual(initial);
		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.availableQuantity).toBe(1);
		expect(result.elapsedMs).toBe(300);
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

	it("returns an already-owned start target without running an action", () => {
		const result = Effect.runSync(makePlanner().searchFx("start-target"));

		expect(result).toMatchObject({
			availableQuantity: 1,
			elapsedMs: 0,
			expandedStates: 0,
			itemId: "start-target",
			quantity: 1,
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
			expandedStates: 1,
			itemId: "random-target",
			outputCertainty: "possible",
			type: "completed",
			trace: [
				{
					outputResolution: {
						outputItemId: "random-target",
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

	it.each([
		"maximumExpandedStates",
		"maximumQueuedStates",
	] as const)("reports the %s search budget without forging impossibility", (budgetLimit) => {
		const result = Effect.runSync(
			makePlanner().searchFx("target", 1, {
				[budgetLimit]: 1,
			}),
		);

		expect(result).toMatchObject({
			budgetLimit,
			itemId: "target",
			reason: "search-budget",
			type: "inconclusive",
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
		expect(result.runtime.items.some(({ item }) => item.id === "item:double-tree")).toBe(true);
	});
});
