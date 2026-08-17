import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemOriginSource } from "~/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationSubgraphFx } from "~/editor/readEditorItemOriginRelationSubgraphFx";
import { readEditorItemOriginRelationsFx } from "~/editor/readEditorItemOriginRelationsFx";
import { readEditorItemOriginSourcesFx } from "~/editor/readEditorItemOriginSourcesFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const readEditorItemOriginSources = (item: Parameters<typeof readEditorItemOriginSourcesFx>[0]) =>
	Effect.runSync(readEditorItemOriginSourcesFx(item));

const readEditorItemOriginRelations = (
	source: Parameters<typeof readEditorItemOriginRelationsFx>[0],
) => Effect.runSync(readEditorItemOriginRelationsFx(source));

const readEditorItemOriginRelationSubgraph = (
	props: Parameters<typeof readEditorItemOriginRelationSubgraphFx>[0],
) => Effect.runSync(readEditorItemOriginRelationSubgraphFx(props));

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
});

describe("editor item origin relations", () => {
	it("preserves authored input and output quantities", async () => {
		const config = await readArkiniGameConfigSource();
		const bakeryBlueprint = config.items["item:blueprint-bakery-t1"];
		expect(bakeryBlueprint).toBeDefined();
		const constructBakery =
			bakeryBlueprint === undefined
				? undefined
				: readEditorItemOriginSources(bakeryBlueprint).find(
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
	});

	it("finds every official Coin producer through output lookup", async () => {
		const config = await readArkiniGameConfigSource();
		const sources = Object.values(config.items).flatMap(readEditorItemOriginSources);
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
