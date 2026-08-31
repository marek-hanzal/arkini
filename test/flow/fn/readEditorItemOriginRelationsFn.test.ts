import { describe, expect, it } from "vitest";

import type { EditorItemOriginSource } from "~/flow/type/EditorItemOriginSource";
import { readEditorItemOriginRelationsFn } from "~/flow/fn/readEditorItemOriginRelationsFn";

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
});
