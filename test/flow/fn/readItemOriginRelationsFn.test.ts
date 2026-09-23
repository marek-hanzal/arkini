import { describe, expect, it } from "vitest";

import type { ItemOriginSource } from "~/flow/type/ItemOriginSource";
import { readItemOriginRelationsFn } from "~/flow/fn/readItemOriginRelationsFn";

const source = ({
	id,
	outputItemUid,
	requirementItemUid,
}: {
	readonly id: string;
	readonly outputItemUid: string;
	readonly requirementItemUid: string;
}): ItemOriginSource => ({
	id,
	inputs: [],
	kind: "line",
	label: id,
	outputs: [
		{
			itemUid: outputItemUid,
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
	ownerItemUid: requirementItemUid,
	reference: {
		lineId: id,
		type: "line",
	},
	requirementItemUids: [
		requirementItemUid,
	],
	routeIds: [
		id,
	],
});

describe("item origin relations", () => {
	it("orders non-ASCII relation IDs by stable code units", () => {
		const relations = readItemOriginRelationsFn({
			...source({
				id: "source:forge",
				outputItemUid: "ingot",
				requirementItemUid: "forge",
			}),
			requirementItemUids: [
				"forge",
				"ä-input",
				"z-input",
			],
		});

		expect(relations.map(({ fromItemUid }) => fromItemUid)).toEqual([
			"z-input",
			"ä-input",
			"forge",
		]);
	});

	it("uses the same external-input and owner-output edges as the origin flow", () => {
		const forge: ItemOriginSource = {
			...source({
				id: "source:forge",
				outputItemUid: "ingot",
				requirementItemUid: "forge",
			}),
			requirementItemUids: [
				"forge",
				"water",
			],
		};

		expect(readItemOriginRelationsFn(forge)).toMatchObject([
			{
				fromItemUid: "water",
				role: "input",
				toItemUid: "forge",
			},
			{
				fromItemUid: "forge",
				outcomeIndex: 0,
				role: "output",
				toItemUid: "ingot",
			},
		]);
	});
});
