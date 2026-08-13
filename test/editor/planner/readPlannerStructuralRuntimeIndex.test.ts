import { describe, expect, it } from "vitest";

import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { readPlannerStructuralRuntimeIndex } from "~/editor/planner/readPlannerStructuralRuntimeIndex";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const baseItem = (id: string, scope: "any" | "board" = "any") => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: id,
	id,
	maxStackSize: 1,
	scope,
	title: id,
	uid: id,
});

const output = (
	itemId: string,
	roll:
		| {
				readonly chance: number;
				readonly type: "chance";
		  }
		| {
				readonly type: "guaranteed";
		  } = {
		type: "guaranteed",
	},
) => ({
	set: [
		{
			roll: [
				{
					...roll,
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
				},
			],
		},
	],
});

const line = ({
	id,
	input = [
		{
			type: "simple" as const,
		},
	],
	outputItemId,
	roll,
	runtimeMs,
}: {
	readonly id: string;
	readonly input?: ReadonlyArray<Record<string, unknown>>;
	readonly outputItemId: string;
	readonly roll?: Parameters<typeof output>[1];
	readonly runtimeMs: number;
}) => ({
	description: id,
	id,
	input,
	output: output(outputItemId, roll),
	rules: [],
	runtimeMs,
	title: id,
});

const producer = (id: string, lines: ReadonlyArray<Record<string, unknown>>) => ({
	...baseItem(id, "board"),
	lines,
	maxQueueSize: 1,
	type: "producer" as const,
});

const simple = (id: string, scope: "any" | "board" = "any") => ({
	...baseItem(id, scope),
	type: "simple" as const,
});

const createConfig = () =>
	GameConfigSchema.parse({
		items: {
			builder: producer("builder", [
				line({
					id: "line:builder:machine",
					outputItemId: "machine",
					runtimeMs: 1_000,
				}),
			]),
			charged: {
				...simple("charged", "board"),
				charges: {
					amount: 3,
					output: output("seed"),
				},
			},
			machine: producer("machine", [
				line({
					id: "line:machine:target",
					outputItemId: "target",
					roll: {
						chance: 0.5,
						type: "chance",
					},
					runtimeMs: 500,
				}),
			]),
			orphan: simple("orphan"),
			seed: simple("seed"),
			spender: producer("spender", [
				line({
					id: "line:spender:run",
					input: [
						{
							charges: {
								cost: 1,
								from: "target",
							},
							query: {
								distance: "close",
								scope: "board",
								selector: {
									itemId: "charged",
									type: "item",
								},
							},
							type: "deposit",
						},
					],
					outputItemId: "waste",
					runtimeMs: 100,
				}),
			]),
			target: simple("target"),
			waste: simple("waste"),
		},
		meta: {
			board: {
				height: 2,
				width: 8,
			},
			id: "game:structural-runtime-index",
			inventory: {
				height: 1,
				width: 4,
			},
			title: "Structural runtime index",
		},
		resources: {
			hero: "builder",
		},
		start: {
			board: [
				{
					itemId: "builder",
					space: 0,
					x: 0,
					y: 0,
				},
				{
					itemId: "spender",
					space: 0,
					x: 1,
					y: 0,
				},
				{
					itemId: "charged",
					space: 0,
					x: 2,
					y: 0,
				},
			],
			currentSpace: 0,
		},
		version: "1.0",
	});

describe("readPlannerStructuralRuntimeIndex", () => {
	it("projects retained infrastructure and exact independent output attempts", () => {
		const config = createConfig();
		const graph = createPlannerAcquisitionGraph(config);
		const runtimes = readPlannerStructuralRuntimeIndex({
			config,
			graph,
		});

		expect(runtimes.get("builder")).toBe(0);
		expect(runtimes.get("machine")).toBe(1_000);
		expect(runtimes.get("target")).toBe(2_000);
		expect(runtimes.has("orphan")).toBe(false);
	});

	it("counts authored spender runs before a charge-depletion output", () => {
		const config = createConfig();
		const graph = createPlannerAcquisitionGraph(config);
		const runtimes = readPlannerStructuralRuntimeIndex({
			config,
			graph,
		});

		expect(runtimes.get("seed")).toBe(300);
	});
});
