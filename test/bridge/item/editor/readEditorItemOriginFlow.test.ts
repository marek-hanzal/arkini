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

	it("shows one direct provenance path without material-input branches", async () => {
		const progress: EditorItemOriginFlowProgress[] = [];
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(true),
				onProgress: (update) => progress.push(update),
				targetItemId: "ingot",
			}),
		);

		expect(flow.obtainable).toBe(true);
		expect(flow.nodes.filter(({ kind }) => kind === "item").map(({ id }) => id)).toEqual([
			"item:ingot",
			"item:forge",
		]);
		expect(flow.nodes).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "item:tool",
				}),
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
		expect(flow.edges).toHaveLength(2);
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

	it("marks the direct source blocked without drawing its missing input branch", async () => {
		const flow = await Effect.runPromise(
			readEditorItemOriginFlowFx({
				config: createReachabilityConfig(false),
				targetItemId: "ingot",
			}),
		);

		expect(flow.obtainable).toBe(false);
		expect(flow.nodes.filter(({ kind }) => kind === "item").map(({ id }) => id)).toEqual([
			"item:ingot",
			"item:forge",
		]);
		expect(flow.nodes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "item:ingot",
					status: "blocked",
				}),
				expect.objectContaining({
					kind: "source",
					status: "blocked",
				}),
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
