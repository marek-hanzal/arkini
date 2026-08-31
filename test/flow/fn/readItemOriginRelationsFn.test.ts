import { describe, expect, it } from "vitest";

import type { ItemOriginSource } from "~/flow/type/ItemOriginSource";
import { readItemOriginRelationsFn } from "~/flow/fn/readItemOriginRelationsFn";

const source = ({
	id,
	outputItemId,
	requirementItemId,
}: {
	readonly id: string;
	readonly outputItemId: string;
	readonly requirementItemId: string;
}): ItemOriginSource => ({
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

describe("item origin relations", () => {
	it("orders non-ASCII relation IDs by stable code units", () => {
		const relations = readItemOriginRelationsFn({
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

	it("uses the same external-input and owner-output edges as the origin flow", () => {
		const forge: ItemOriginSource = {
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

		expect(readItemOriginRelationsFn(forge)).toMatchObject([
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
