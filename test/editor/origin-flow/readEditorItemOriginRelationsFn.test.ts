import { describe, expect, it } from "vitest";

import type { EditorItemOriginSource } from "~/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationSubgraphFn } from "~/editor/origin-flow/fn/readEditorItemOriginRelationSubgraphFn";
import { readEditorItemOriginRelationsFn } from "~/editor/origin-flow/fn/readEditorItemOriginRelationsFn";

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
	inputs: [],
	kind: "line",
	label: id,
	outputs: [
		{
			itemId: outputItemId,
			placement: undefined,
			quantity: {
				max: 1,
				min: 1,
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
	ownerItemId: requirementItemId,
	reference: {
		lineId: id,
		type: "line",
	},
	requirementItemIds: [
		requirementItemId,
	],
	routeIds: [
		id,
	],
});

describe("editor item origin relations", () => {
	it("orders non-ASCII relation IDs by stable code units", () => {
		const relations = readEditorItemOriginRelationsFn({
			...source({
				id: "source:forge",
				outputItemId: "ingot",
				requirementItemId: "forge",
			}),
			requirementItemIds: [
				"forge",
				"ä-input",
				"z-input",
			],
		});

		expect(relations.map(({ fromItemId }) => fromItemId)).toEqual([
			"z-input",
			"ä-input",
			"forge",
		]);
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

		expect(readEditorItemOriginRelationsFn(forge)).toMatchObject([
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
		const sources = [
			forge,
			source({
				id: "source:ingot",
				outputItemId: "plate",
				requirementItemId: "ingot",
			}),
			source({
				id: "source:kiln",
				outputItemId: "ingot",
				requirementItemId: "kiln",
			}),
			{
				...source({
					id: "source:mill",
					outputItemId: "dust",
					requirementItemId: "mill",
				}),
				requirementItemIds: [
					"mill",
					"forge",
				],
			},
		];
		const readRelations = (level: number, role: "input" | "output", targetItemId: string) =>
			readEditorItemOriginRelationSubgraphFn({
				level,
				role,
				sources,
				targetItemId,
			}).relations;
		const inputLevelOne = readRelations(1, "input", "water");
		expect(inputLevelOne).toHaveLength(1);
		expect(inputLevelOne).toMatchObject([
			{
				fromItemId: "water",
				level: 1,
				toItemId: "forge",
			},
		]);
		const outputLevelOne = readRelations(1, "output", "ingot");
		expect(outputLevelOne).toHaveLength(2);
		expect(outputLevelOne).toMatchObject([
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

		expect(readRelations(2, "input", "water")).toMatchObject([
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
		expect(readRelations(2, "output", "plate")).toMatchObject([
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
