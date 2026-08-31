import { Order } from "effect";

import type { ItemOriginRelation, ItemOriginSource } from "~/flow/type/ItemOriginSource";

const uniqueFn = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const projectItemOriginRelationsFn = (source: ItemOriginSource): ItemOriginRelation[] => [
	...uniqueFn(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => Order.String(left, right))
		.map((itemId) => ({
			fromItemId: itemId,
			role: "input" as const,
			source,
			toItemId: source.ownerItemId,
		})),
	...source.outputs.map((output, outputIndex) => ({
		fromItemId: source.ownerItemId,
		outputIndex,
		role: "output" as const,
		source,
		toItemId: output.itemId,
	})),
];

/** Projects the exact item-to-item edges materialized by the origin flow. */
export const readItemOriginRelationsFn = (source: ItemOriginSource) =>
	projectItemOriginRelationsFn(source);
