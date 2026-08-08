import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlowProgress,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import type { EditorOutput } from "~/bridge/item/editor/EditorItemModel";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

type EditorGuaranteedRoll = Extract<
	EditorOutput["set"][number]["roll"][number],
	{
		readonly type: "guaranteed";
	}
>;

const outputDrop = (itemId: string): EditorGuaranteedRoll["drop"][number] => ({
	itemId,
	placement: "drop",
	quantity: {
		min: 1,
		max: 1,
	},
	rules: [],
});

const outputOf = (itemId: string, ...additionalItemIds: ReadonlyArray<string>): EditorOutput => ({
	set: [
		{
			weight: 1,
			roll: [
				{
					type: "guaranteed",
					drop: [
						outputDrop(itemId),
						...additionalItemIds.map(outputDrop),
					] as EditorGuaranteedRoll["drop"],
				},
			],
		},
	],
});

const createReachabilityConfig = (includeTool: boolean) => {
	const base = createJobTestConfig();
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		start: {
			currentSpace: 0,
			board: [
				{
					itemId: "forge",
					space: 0,
					x: 0,
					y: 0,
				},
			],
			inventory: [
				{
					itemId: "water",
					quantity: 3,
				},
				...(includeTool
					? [
							{
								itemId: "tool",
								quantity: 1,
							},
						]
					: []),
			],
			toolbar: [],
		},
		items: {
			...base.items,
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					output: outputOf("ingot"),
				})),
			},
			ingot: {
				...base.items.tool,
				uid: "ingot",
				id: "ingot",
				title: "Ingot",
				description: "A forged ingot.",
			},
		},
	});
};

describe("readEditorItemOriginFlow", () => {
	it("builds the complete project graph when no item filter is supplied", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
			}),
		);

		expect(flow.obtainable).toBeUndefined();
		expect(flow.nodes.find((node) => node.kind === "item" && node.id === "item:ingot")).toEqual(
			expect.objectContaining({
				acquisitionSourceId: expect.stringContaining("source:forge:line:"),
			}),
		);
		expect(flow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "item:forge",
					kind: "item",
				}),
				expect.objectContaining({
					id: "item:ingot",
					kind: "item",
				}),
				expect.objectContaining({
					id: "item:tool",
					kind: "item",
				}),
				expect.objectContaining({
					kind: "source",
					sourceKind: "line",
				}),
			]),
		);
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: "item:forge",
					target: expect.stringContaining("source:forge:line:"),
				}),
				expect.objectContaining({
					source: expect.stringContaining("source:forge:line:"),
					target: "item:ingot",
				}),
			]),
		);
	});

	it("shows every required input on a readable acquisition backbone back to starter items", async () => {
		const progress: EditorItemOriginFlowProgress[] = [];
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
				onProgress: (update) => progress.push(update),
				targetItemId: "ingot",
			}),
		);

		expect(flow.obtainable).toBe(true);
		expect(
			new Set(flow.nodes.filter(({ kind }) => kind === "item").map(({ id }) => id)),
		).toEqual(
			new Set([
				"item:ingot",
				"item:forge",
				"item:tool",
				"item:water",
			]),
		);
		expect(flow.nodes.filter(({ kind }) => kind === "source")).toEqual([
			expect.objectContaining({
				kind: "source",
				placement: "drop",
				selectionKind: "guaranteed",
				sourceKind: "line",
				status: "reachable",
				weightedSet: false,
			}),
		]);
		expect(flow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "item:forge",
					starterScopes: [
						"Board",
					],
					status: "starter",
				}),
				expect.objectContaining({
					id: "item:ingot",
					status: "reachable",
				}),
			]),
		);
		expect(flow.nodes.find((node) => node.kind === "item" && node.id === "item:ingot")).toEqual(
			expect.objectContaining({
				acquisitionSourceId: expect.stringContaining("source:forge:line:"),
			}),
		);
		expect(flow.edges).toHaveLength(4);
		expect(progress[0]).toMatchObject({
			percent: 0,
			phase: "indexing",
		});
		expect(progress.at(-1)).toMatchObject({
			percent: 100,
			phase: "finalizing",
		});
		expect(
			progress.every(
				(update, index) => index === 0 || update.percent >= progress[index - 1]!.percent,
			),
		).toBe(true);
	});

	it("stops Income immediately when the selected item already exists at game start", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
				direction: "income",
				targetItemId: "forge",
			}),
		);

		expect(flow.obtainable).toBe(true);
		expect(flow.nodes).toEqual([
			expect.objectContaining({
				id: "item:forge",
				status: "starter",
			}),
		]);
		expect(flow.edges).toEqual([]);
	});

	it("orients Income from prerequisites toward the selected item as the sink", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
				direction: "income",
				targetItemId: "ingot",
			}),
		);
		const source = flow.nodes.find(({ kind }) => kind === "source");
		if (source === undefined) throw new Error("Expected source node.");

		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: "item:forge",
					target: source.id,
				}),
				expect.objectContaining({
					source: "item:tool",
					target: source.id,
				}),
				expect.objectContaining({
					source: "item:water",
					target: source.id,
				}),
				expect.objectContaining({
					source: source.id,
					target: "item:ingot",
				}),
			]),
		);
	});

	it("traces Outcome from the selected item toward every reachable result", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
				direction: "outcome",
				targetItemId: "forge",
			}),
		);
		const source = flow.nodes.find(({ kind }) => kind === "source");
		if (source === undefined) throw new Error("Expected source node.");

		expect(
			new Set(flow.nodes.filter(({ kind }) => kind === "item").map(({ id }) => id)),
		).toEqual(
			new Set([
				"item:forge",
				"item:ingot",
			]),
		);
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: "item:forge",
					target: source.id,
				}),
				expect.objectContaining({
					source: source.id,
					target: "item:ingot",
				}),
			]),
		);
	});

	it("chooses one deterministic reachable producer when the target has alternatives", async () => {
		const base = createReachabilityConfig(true);
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					...base.start.board,
					{
						itemId: "kiln",
						space: 0,
						x: 1,
						y: 0,
					},
				],
			},
			items: {
				...base.items,
				kiln: {
					...forge,
					uid: "kiln",
					id: "kiln",
					title: "Kiln",
					lines: forge.lines.map((line) => ({
						...line,
						id: `kiln:${line.id}`,
						output: outputOf("ingot"),
					})),
				},
			},
		});

		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
				targetItemId: "ingot",
			}),
		);
		const sourceNodes = flow.nodes.filter(({ kind }) => kind === "source");

		expect(sourceNodes).toHaveLength(1);
		expect(sourceNodes[0]?.id).toContain("source:forge:line:");
		expect(sourceNodes[0]?.id).not.toContain("source:kiln:line:");
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: sourceNodes[0]?.id,
					target: "item:ingot",
				}),
			]),
		);
		expect(flow.obtainable).toBe(true);
	});

	it("keeps chance, random placement and depletion semantics on the exact source", async () => {
		const base = createReachabilityConfig(true);
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const ingot = base.items.ingot;
		const chanceOutput: EditorOutput = {
			set: [
				{
					weight: 1,
					roll: [
						{
							type: "chance",
							chance: 0.25,
							drop: [
								{
									...outputDrop("ingot"),
									placement: "random",
								},
							],
						},
					],
				},
			],
		};
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: chanceOutput,
					})),
				},
				ingot: {
					...ingot,
					charges: {
						amount: 1,
						output: outputOf("dust"),
					},
				},
				dust: {
					...base.items.tool,
					uid: "dust",
					id: "dust",
					title: "Dust",
				},
			},
		});

		const chanceFlow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
				targetItemId: "ingot",
			}),
		);
		expect(chanceFlow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "source",
					placement: "random",
					selectionKind: "chance",
					sourceKind: "line",
				}),
			]),
		);

		const depletionFlow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
				targetItemId: "dust",
			}),
		);
		expect(depletionFlow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "source",
					placement: "drop",
					selectionKind: "guaranteed",
					sourceKind: "charges",
				}),
			]),
		);
	});

	it("keeps every Income prerequisite visible when one upstream requirement is blocked", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(false),
				direction: "income",
				targetItemId: "ingot",
			}),
		);

		expect(flow.obtainable).toBe(false);
		expect(
			new Set(flow.nodes.filter(({ kind }) => kind === "item").map(({ id }) => id)),
		).toEqual(
			new Set([
				"item:ingot",
				"item:forge",
				"item:tool",
				"item:water",
			]),
		);
		expect(flow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "item:ingot",
					status: "blocked",
				}),
				expect.objectContaining({
					id: "item:tool",
					status: "blocked",
				}),
				expect.objectContaining({
					kind: "source",
					status: "blocked",
				}),
			]),
		);
		expect(flow.edges).toHaveLength(4);
	});

	it("terminates cyclic acquisition paths and exposes the cycle", async () => {
		const base = createJobTestConfig();
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const line = forge.lines[0];
		const producer = (id: string, output: EditorOutput) => ({
			...forge,
			uid: id,
			id,
			title: id,
			lines: [
				{
					...line,
					id: `line:${id}`,
					input: [
						{
							type: "simple" as const,
						},
					],
					output,
				},
			],
		});
		const config = GameConfigSchema.parse({
			...base,
			start: {
				currentSpace: 0,
				board: [],
				inventory: [],
				toolbar: [],
			},
			items: {
				a: producer("a", outputOf("b", "target")),
				b: producer("b", outputOf("a")),
				target: {
					...base.items.tool,
					uid: "target",
					id: "target",
					title: "Target",
				},
			},
		});

		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
				targetItemId: "target",
			}),
		);

		expect(flow.obtainable).toBe(false);
		expect(flow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "item",
					status: "cycle",
				}),
			]),
		);
	});
});
