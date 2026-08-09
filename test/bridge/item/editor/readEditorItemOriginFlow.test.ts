import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlow,
	type EditorItemOriginFlowProgress,
	type EditorItemOriginItemNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import type { EditorOutput } from "~/bridge/item/editor/EditorItemModel";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";

type EditorGuaranteedRoll = Extract<
	EditorOutput["set"][number]["roll"][number],
	{
		readonly type: "guaranteed";
	}
>;

const outputDrop = (itemId: string): EditorGuaranteedRoll["drop"][number] => ({
	itemId,
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
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

const itemNode = (flow: EditorItemOriginFlow, id: string): EditorItemOriginItemNode => {
	const node = flow.nodes.find((candidate) => candidate.id === `item:${id}`);
	if (node === undefined) throw new Error(`Expected item:${id}.`);
	return node;
};

describe("readEditorItemOriginFlow", () => {
	it("builds an item-only graph with operations embedded in their owner", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
			}),
		);
		const forge = itemNode(flow, "forge");

		expect(forge).toEqual(
			expect.objectContaining({
				operations: [
					expect.objectContaining({
						kind: "line",
						inputs: expect.arrayContaining([
							expect.objectContaining({
								itemId: "tool",
							}),
							expect.objectContaining({
								itemId: "water",
							}),
						]),
						outputs: [
							expect.objectContaining({
								itemId: "ingot",
							}),
						],
					}),
				],
			}),
		);
		expect(itemNode(flow, "ingot")).toEqual(
			expect.objectContaining({
				acquisitionSourceId: expect.stringContaining("source:forge:line:"),
			}),
		);
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: "input",
					source: "item:tool",
					sourcePortId: EditorItemOriginItemOutputPortId,
					target: "item:forge",
					targetPortId: expect.any(String),
				}),
				expect.objectContaining({
					role: "input",
					source: "item:water",
					target: "item:forge",
					targetPortId: expect.any(String),
				}),
				expect.objectContaining({
					role: "output",
					source: "item:forge",
					target: "item:ingot",
					sourcePortId: expect.any(String),
					targetPortId: EditorItemOriginItemInputPortId,
				}),
			]),
		);
	});

	it("keeps one complete Income proof with every mandatory prerequisite", async () => {
		const progress: EditorItemOriginFlowProgress[] = [];
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
				onProgress: (update) => progress.push(update),
				targetItemId: "ingot",
			}),
		);

		expect(new Set(flow.nodes.map(({ id }) => id))).toEqual(
			new Set([
				"item:ingot",
				"item:forge",
				"item:tool",
				"item:water",
			]),
		);
		expect(flow.edges).toHaveLength(3);
		expect(itemNode(flow, "forge")).toEqual(
			expect.objectContaining({
				starterScopes: [
					"Board",
				],
				operations: [
					expect.objectContaining({
						inputs: expect.arrayContaining([
							expect.objectContaining({
								itemId: "tool",
							}),
							expect.objectContaining({
								itemId: "water",
							}),
						]),
					}),
				],
			}),
		);
		expect(progress[0]).toMatchObject({
			label: "Indexing sources",
			percent: 0,
		});
		expect(progress.at(-1)).toMatchObject({
			label: "Preparing flow",
			percent: 100,
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
				targetItemId: "forge",
			}),
		);

		expect(flow.nodes).toEqual([
			expect.objectContaining({
				id: "item:forge",
				operations: [],
			}),
		]);
		expect(flow.edges).toEqual([]);
	});

	it("chooses one deterministic reachable producer when a target has alternatives", async () => {
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
		expect(flow.nodes.some(({ id }) => id === "item:forge")).toBe(true);
		expect(flow.nodes.some(({ id }) => id === "item:kiln")).toBe(false);
		expect(itemNode(flow, "forge")).toEqual(
			expect.objectContaining({
				operations: [
					expect.objectContaining({
						outputs: [
							expect.objectContaining({
								itemId: "ingot",
							}),
						],
					}),
				],
			}),
		);
	});

	it("embeds chance and depletion outputs as operation ports", async () => {
		const base = createReachabilityConfig(true);
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
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
					...base.items.ingot,
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
		const forgeOutput = itemNode(chanceFlow, "forge").operations[0]?.outputs[0];
		expect(forgeOutput).toMatchObject({
			itemId: "ingot",
		});

		const depletionFlow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
				targetItemId: "dust",
			}),
		);
		expect(itemNode(depletionFlow, "ingot").operations).toEqual([
			expect.objectContaining({
				kind: "charges",
				outputs: [
					expect.objectContaining({
						itemId: "dust",
					}),
				],
			}),
		]);
	});

	it("embeds merge input and result ports in the source item", async () => {
		const config = createMergeTestConfig({
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "replace",
				result: "result",
			},
		});
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config,
			}),
		);
		const source = itemNode(flow, "source");
		const merge = source.operations.find(({ kind }) => kind === "merge");

		expect(merge).toEqual(
			expect.objectContaining({
				label: "Merge",
				inputs: [
					expect.objectContaining({
						itemId: "target",
					}),
				],
				outputs: [
					expect.objectContaining({
						itemId: "result",
					}),
				],
			}),
		);
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: "input",
					source: "item:target",
					target: "item:source",
					targetPortId: merge?.inputs[0]?.id,
				}),
				expect.objectContaining({
					role: "output",
					source: "item:source",
					target: "item:result",
					sourcePortId: merge?.outputs[0]?.id,
				}),
			]),
		);
	});

	it("keeps blocked Income prerequisites visible", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(false),
				targetItemId: "ingot",
			}),
		);

		expect(new Set(flow.nodes.map(({ id }) => id))).toEqual(
			new Set([
				"item:ingot",
				"item:forge",
				"item:tool",
				"item:water",
			]),
		);
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
		expect(new Set(flow.nodes.map(({ id }) => id))).toEqual(
			new Set([
				"item:a",
				"item:b",
				"item:target",
			]),
		);
	});
});
