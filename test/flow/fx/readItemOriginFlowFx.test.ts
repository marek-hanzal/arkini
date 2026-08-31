import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	ItemOriginItemInputPortId,
	ItemOriginItemOutputPortId,
	type ItemOriginFlow,
	type ItemOriginFlowProgress,
	type ItemOriginItemNode,
} from "~/flow/type/ItemOriginFlow";
import { readItemOriginFlowFx } from "~/flow/fx/readItemOriginFlowFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuleSchema as LineRuleSchema } from "~/production-line/schema/RuleSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";

type GuaranteedRoll = Extract<
	OutputSchema.Type["set"][number]["roll"][number],
	{
		readonly type: "guaranteed";
	}
>;

const outputDrop = (itemId: string): GuaranteedRoll["drop"][number] => ({
	itemId,
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
});

const outputOf = (
	itemId: string,
	...additionalItemIds: ReadonlyArray<string>
): OutputSchema.Type => ({
	set: [
		{
			weight: 1,
			roll: [
				{
					type: "guaranteed",
					drop: [
						outputDrop(itemId),
						...additionalItemIds.map(outputDrop),
					] as GuaranteedRoll["drop"],
				},
			],
		},
	],
});

const availabilityRule = (
	itemId: string,
): Extract<
	LineRuleSchema.Type,
	{
		type: "enable";
	}
> => ({
	type: "enable" as const,
	when: [
		{
			query: {
				scope: "universe" as const,
				selector: {
					itemId,
					type: "item" as const,
				},
			},
			type: "exists" as const,
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
					position: {
						x: 0,
						y: 0,
					},
					quantity: 3,
				},
				...(includeTool
					? [
							{
								itemId: "tool",
								position: {
									x: 1,
									y: 0,
								},
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

const itemNode = (flow: ItemOriginFlow, id: string): ItemOriginItemNode => {
	const node = flow.nodes.find((candidate) => candidate.id === `item:${id}`);
	if (node === undefined) throw new Error(`Expected item:${id}.`);
	return node;
};

describe("readItemOriginFlow", () => {
	it("builds an item-only graph with operations embedded in their owner", async () => {
		const flow = await Effect.runPromise(
			readItemOriginFlowFx({
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
				acquisitionSourceId: "source:forge:line:line:forge:run",
			}),
		);
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: "input",
					source: "item:tool",
					sourcePortId: ItemOriginItemOutputPortId,
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
					targetPortId: ItemOriginItemInputPortId,
				}),
			]),
		);
	});

	it("keeps every authored item and mandatory requirement in the complete graph", async () => {
		const progress: ItemOriginFlowProgress[] = [];
		const flow = await Effect.runPromise(
			readItemOriginFlowFx({
				config: createReachabilityConfig(true),
				onProgress: (update) => progress.push(update),
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
		const forgeOperation = itemNode(flow, "forge").operations[0];
		expect(
			forgeOperation?.inputs.find(({ itemId }) => itemId === "water")?.requirementContexts,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					clause: "all-of",
					requirement: expect.objectContaining({
						itemId: "water",
						sources: [
							"material-input",
						],
						usage: "consume",
					}),
				}),
			]),
		);
		expect(
			flow.edges.find((edge) => edge.role === "input" && edge.source === "item:water")
				?.requirementContexts,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					clause: "all-of",
				}),
			]),
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

	it("keeps raw line and output conditions in canonical graph sources", async () => {
		const base = createReachabilityConfig(true);
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const conditionedOutput: OutputSchema.Type = {
			set: [
				{
					weight: 1,
					roll: [
						{
							type: "guaranteed",
							drop: [
								{
									...outputDrop("ingot"),
									rules: [
										availabilityRule("output-permit"),
									],
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
						output: conditionedOutput,
						rules: [
							availabilityRule("line-permit"),
						],
					})),
				},
				"line-permit": {
					...base.items.tool,
					id: "line-permit",
					title: "Line Permit",
					uid: "line-permit",
				},
				"output-permit": {
					...base.items.tool,
					id: "output-permit",
					title: "Output Permit",
					uid: "output-permit",
				},
			},
		});

		const flow = await Effect.runPromise(
			readItemOriginFlowFx({
				config,
			}),
		);

		const nodeIds = new Set(flow.nodes.map(({ id }) => id));
		expect(nodeIds.has("item:line-permit")).toBe(true);
		expect(nodeIds.has("item:output-permit")).toBe(true);
	});

	it("embeds chance outputs and omits depletion without an authored charge spender", async () => {
		const base = createReachabilityConfig(true);
		const forge = base.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const chanceOutput: OutputSchema.Type = {
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

		const flow = await Effect.runPromise(
			readItemOriginFlowFx({
				config,
			}),
		);
		const forgeOutput = itemNode(flow, "forge").operations[0]?.outputs[0];
		expect(forgeOutput).toMatchObject({
			itemId: "ingot",
		});
		expect(itemNode(flow, "dust").acquisitionSourceId).toBeUndefined();
		expect(flow.edges.some(({ target }) => target === "item:dust")).toBe(false);
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
			readItemOriginFlowFx({
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
});
