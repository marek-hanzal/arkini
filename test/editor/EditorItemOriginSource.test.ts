import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemOriginSource } from "~/editor/EditorItemOriginSource";
import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { readEditorItemOriginRelationSubgraphFx } from "~/editor/readEditorItemOriginRelationSubgraphFx";
import { readEditorItemOriginRelationsFx } from "~/editor/readEditorItemOriginRelationsFx";
import { readEditorItemOriginSourcesFx } from "~/editor/readEditorItemOriginSourcesFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { existsWhen } from "~test/line/fx/support/lineTestRuntime";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const readEditorItemOriginSources = (
	config: Parameters<typeof createEditorAcquisitionGraphFx>[0],
) =>
	Effect.runSync(
		readEditorItemOriginSourcesFx(Effect.runSync(createEditorAcquisitionGraphFx(config))),
	);

const readEditorItemOriginRelations = (
	source: Parameters<typeof readEditorItemOriginRelationsFx>[0],
) => Effect.runSync(readEditorItemOriginRelationsFx(source));

const readEditorItemOriginRelationSubgraph = (
	props: Parameters<typeof readEditorItemOriginRelationSubgraphFx>[0],
) => Effect.runSync(readEditorItemOriginRelationSubgraphFx(props));

const dropOf = (itemId: string): DropSchema.Type => ({
	itemId,
	placement: "drop",
	quantity: {
		max: 1,
		min: 1,
	},
	rules: [],
});

const outputOf = (itemId: string): OutputSchema.Type => ({
	set: [
		{
			roll: [
				{
					drop: [
						dropOf(itemId),
					],
					type: "guaranteed",
				},
			],
			weight: 1,
		},
	],
});

const source = ({
	id,
	outputItemId,
	requirementItemId,
}: {
	readonly id: string;
	readonly outputItemId: string;
	readonly requirementItemId: string;
}): EditorItemOriginSource => ({
	id,
	kind: "line",
	label: id,
	outputs: [
		{
			itemId: outputItemId,
			placement: undefined,
			quantity: {
				min: 1,
				max: 1,
			},
			requirements: {
				allOf: [],
				anyOf: [],
			},
			routeId: id,
			selectionKind: "guaranteed",
			weightedSet: false,
		},
	],
	inputs: [],
	ownerItemId: requirementItemId,
	reference: {
		type: "line",
		lineId: id,
	},
	requirementItemIds: [
		requirementItemId,
	],
	routeIds: [
		id,
	],
});

describe("editor item origin relations", () => {
	it("uses canonical route IDs, conditions, and positive-probability outputs", () => {
		const config = structuredClone(createJobTestConfig());
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		for (const itemId of [
			"dust",
			"ingot",
			"permit",
		])
			config.items[itemId] = {
				...config.items.tool,
				id: itemId,
				title: itemId,
				uid: itemId,
			};
		const line = forge.lines[0]!;
		const ingotDrop = dropOf("ingot");
		ingotDrop.rules.push({
			type: "enable",
			when: [
				existsWhen("permit"),
			],
		});
		line.output = {
			set: [
				{
					roll: [
						{
							chance: 0,
							drop: [
								dropOf("dust"),
							],
							type: "chance",
						},
						{
							drop: [
								ingotDrop,
							],
							type: "guaranteed",
						},
					],
					weight: 1,
				},
			],
		};
		line.rules.push({
			type: "enable",
			when: [
				existsWhen("permit"),
			],
		});
		forge.lines.push({
			...line,
			enable: false,
			id: "line:forge:disabled",
			output: outputOf("dust"),
			rules: [],
		});
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const sources = Effect.runSync(readEditorItemOriginSourcesFx(graph));

		expect(sources).toHaveLength(1);
		expect(sources[0]?.routeIds).toEqual(graph.routes.map(({ id }) => id));
		expect(sources.flatMap(({ outputs }) => outputs.map(({ itemId }) => itemId))).toEqual([
			"ingot",
		]);
		expect(sources[0]).toMatchObject({
			id: "source:forge:line:line:forge:run",
			outputs: [
				expect.objectContaining({
					requirements: {
						allOf: expect.arrayContaining([
							expect.objectContaining({
								itemId: "permit",
							}),
						]),
						anyOf: [],
						unsupported: [],
					},
				}),
			],
		});
	});

	it("shares the compiler's first-match merge routes", () => {
		const config = createMergeTestConfig({
			rule: [
				{
					action: "consume",
					effect: "replace",
					result: "result",
					target: {
						itemId: "target",
						type: "item",
					},
				},
				{
					action: "consume",
					effect: "replace",
					result: "output",
					target: {
						itemId: "target",
						type: "item",
					},
				},
			],
		});
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const sources = Effect.runSync(readEditorItemOriginSourcesFx(graph));

		expect(sources).toHaveLength(1);
		expect(sources[0]?.routeIds).toEqual(graph.routes.map(({ id }) => id));
		expect(sources.flatMap(({ outputs }) => outputs.map(({ itemId }) => itemId))).toEqual([
			"result",
		]);
	});

	it("keeps output-specific requirement clauses on their own occurrence", () => {
		const config = structuredClone(createJobTestConfig());
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		for (const itemId of [
			"permit-a",
			"permit-b",
			"slag",
		])
			config.items[itemId] = {
				...config.items.tool,
				id: itemId,
				title: itemId,
				uid: itemId,
			};
		const conditionedDrop = (itemId: string, permitId: string): DropSchema.Type => ({
			...dropOf(itemId),
			rules: [
				{
					type: "enable" as const,
					when: [
						existsWhen(permitId),
					],
				},
			],
		});
		forge.lines[0]!.output = {
			set: [
				{
					roll: [
						{
							drop: [
								conditionedDrop("ingot", "permit-a"),
								conditionedDrop("slag", "permit-b"),
							],
							type: "guaranteed",
						},
					],
					weight: 1,
				},
			],
		};

		const source = readEditorItemOriginSources(config).find(
			({ reference }) => reference.type === "line" && reference.lineId === "line:forge:run",
		);
		const ingot = source?.outputs.find(({ itemId }) => itemId === "ingot");
		const slag = source?.outputs.find(({ itemId }) => itemId === "slag");

		expect(ingot?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-a",
					sources: [
						"output-condition",
					],
				}),
			]),
		);
		expect(ingot?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-b",
				}),
			]),
		);
		expect(slag?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-b",
					sources: [
						"output-condition",
					],
				}),
			]),
		);
		expect(slag?.requirements.allOf).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "permit-a",
				}),
			]),
		);

		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const withAlternativeClause = {
			...graph,
			routes: graph.routes.map((route) =>
				route.output.factId === "slag"
					? {
							...route,
							requirements: {
								...route.requirements,
								anyOf: [
									[
										{
											factId: "permit-a",
											quantity: 1,
											source: "output-condition" as const,
											usage: "ongoing" as const,
										},
										{
											factId: "permit-b",
											quantity: 1,
											source: "output-condition" as const,
											usage: "ongoing" as const,
										},
									],
								],
								unsupported: [
									{
										factId: "permit-a",
										reason: "upper-bound" as const,
										source: "output-condition" as const,
									},
								],
							},
						}
					: route,
			),
		};
		const alternativeSlag = Effect.runSync(readEditorItemOriginSourcesFx(withAlternativeClause))
			.flatMap(({ outputs }) => outputs)
			.find(({ itemId }) => itemId === "slag");
		expect(alternativeSlag?.requirements.anyOf).toEqual([
			[
				expect.objectContaining({
					itemId: "permit-a",
				}),
				expect.objectContaining({
					itemId: "permit-b",
				}),
			],
		]);
		expect(alternativeSlag?.requirements.unsupported).toEqual([
			{
				itemId: "permit-a",
				reason: "upper-bound",
				source: "output-condition",
			},
		]);
	});

	it("preserves authored input and output quantities", async () => {
		const config = await readArkiniGameConfigSource();
		const constructBakery = readEditorItemOriginSources(config).find(
			({ reference }) =>
				reference.type === "line" &&
				reference.lineId === "line:blueprint:bakery-t1:construct",
		);

		expect(constructBakery?.inputs).toEqual([
			{
				itemId: "item:plank",
				quantity: {
					min: 2,
					max: 2,
				},
			},
			{
				itemId: "item:stone-block",
				quantity: {
					min: 1,
					max: 1,
				},
			},
			{
				itemId: "item:flour",
				quantity: {
					min: 1,
					max: 1,
				},
			},
			{
				itemId: "item:water",
				quantity: {
					min: 1,
					max: 1,
				},
			},
		]);
		expect(constructBakery?.outputs).toMatchObject([
			{
				itemId: "producer:bakery-t1",
				quantity: {
					min: 1,
					max: 1,
				},
			},
		]);
		expect(constructBakery?.runtimeMs).toBe(24_000);

		const burnBioWaste = readEditorItemOriginSources(config).find(
			({ reference }) =>
				reference.type === "line" &&
				reference.lineId === "line:bio-waste-processor-t1:burn-bio-waste-log",
		);
		expect(burnBioWaste?.inputs).toContainEqual({
			itemId: "item:bio-waste",
			quantity: {
				max: 4,
				min: 1,
			},
		});
	});

	it("groups official line outputs and retains the charged payer occurrence", async () => {
		const config = await readArkiniGameConfigSource();
		const sources = readEditorItemOriginSources(config).filter(
			({ reference }) =>
				reference.type === "line" && reference.lineId === "line:lumberjack-t1:log",
		);

		expect(sources).toHaveLength(1);
		expect(sources[0]).toMatchObject({
			id: "source:producer:lumberjack-t1:line:line:lumberjack-t1:log",
			inputs: [
				{
					itemId: "item:tree",
					quantity: {
						max: 1,
						min: 1,
					},
				},
			],
			outputs: [
				expect.objectContaining({
					itemId: "item:log",
				}),
				expect.objectContaining({
					itemId: "item:quest:road-repair",
				}),
			],
			routeIds: [
				expect.stringContaining("item:log"),
				expect.stringContaining("item:quest:road-repair"),
			],
		});
	});

	it("finds every official Coin producer through output lookup", async () => {
		const config = await readArkiniGameConfigSource();
		const sources = readEditorItemOriginSources(config);
		const expectedProducerIds = new Set(
			sources
				.flatMap(readEditorItemOriginRelations)
				.filter(({ role, toItemId }) => role === "output" && toItemId === "item:coin")
				.map(({ fromItemId }) => fromItemId),
		);
		const coinOutput = readEditorItemOriginRelationSubgraph({
			level: 1,
			role: "output",
			sources,
			targetItemId: "item:coin",
		});

		expect(expectedProducerIds.size).toBeGreaterThan(1);
		expect(new Set(coinOutput.relations.map(({ fromItemId }) => fromItemId))).toEqual(
			expectedProducerIds,
		);
		expect(coinOutput.itemIds).toEqual(
			new Set([
				"item:coin",
				...expectedProducerIds,
			]),
		);
	});

	it("uses the same external-input and owner-output edges as the editor flow", () => {
		const forge: EditorItemOriginSource = {
			...source({
				id: "source:forge",
				outputItemId: "ingot",
				requirementItemId: "forge",
			}),
			requirementItemIds: [
				"forge",
				"water",
			],
		};
		expect(readEditorItemOriginRelations(forge)).toMatchObject([
			{
				fromItemId: "water",
				role: "input",
				toItemId: "forge",
			},
			{
				fromItemId: "forge",
				outputIndex: 0,
				role: "output",
				toItemId: "ingot",
			},
		]);
	});

	it("traverses input and output edges independently by relationship level", () => {
		const forge: EditorItemOriginSource = {
			...source({
				id: "source:forge",
				outputItemId: "ingot",
				requirementItemId: "forge",
			}),
			requirementItemIds: [
				"forge",
				"water",
			],
		};
		const ingot = source({
			id: "source:ingot",
			outputItemId: "plate",
			requirementItemId: "ingot",
		});
		const kiln = source({
			id: "source:kiln",
			outputItemId: "ingot",
			requirementItemId: "kiln",
		});
		const mill: EditorItemOriginSource = {
			...source({
				id: "source:mill",
				outputItemId: "dust",
				requirementItemId: "mill",
			}),
			requirementItemIds: [
				"mill",
				"forge",
			],
		};
		const sources = [
			forge,
			ingot,
			kiln,
			mill,
		];

		const inputLevelOne = readEditorItemOriginRelationSubgraph({
			level: 1,
			role: "input",
			sources,
			targetItemId: "water",
		});
		expect(inputLevelOne.relations).toMatchObject([
			{
				fromItemId: "water",
				level: 1,
				toItemId: "forge",
			},
		]);
		const inputLevelTwo = readEditorItemOriginRelationSubgraph({
			level: 2,
			role: "input",
			sources,
			targetItemId: "water",
		});
		expect(inputLevelTwo.relations).toMatchObject([
			{
				fromItemId: "water",
				level: 1,
				toItemId: "forge",
			},
			{
				fromItemId: "forge",
				level: 2,
				toItemId: "mill",
			},
		]);

		const outputLevelOne = readEditorItemOriginRelationSubgraph({
			level: 1,
			role: "output",
			sources,
			targetItemId: "ingot",
		});
		expect(outputLevelOne.relations).toMatchObject([
			{
				fromItemId: "forge",
				level: 1,
				toItemId: "ingot",
			},
			{
				fromItemId: "kiln",
				level: 1,
				toItemId: "ingot",
			},
		]);
		const outputLevelTwo = readEditorItemOriginRelationSubgraph({
			level: 2,
			role: "output",
			sources,
			targetItemId: "plate",
		});
		expect(outputLevelTwo.relations).toMatchObject([
			{
				fromItemId: "ingot",
				level: 1,
				toItemId: "plate",
			},
			{
				fromItemId: "forge",
				level: 2,
				toItemId: "ingot",
			},
			{
				fromItemId: "kiln",
				level: 2,
				toItemId: "ingot",
			},
		]);
	});
});
