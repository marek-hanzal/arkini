import { Order } from "effect";

import type { ItemOriginRelation, ItemOriginSource } from "~/flow/type/ItemOriginSource";

const uniqueFn = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const projectItemOriginRelationsFn = (source: ItemOriginSource): ItemOriginRelation[] => [
	...uniqueFn(source.requirementItemUids)
		.filter((itemUid) => itemUid !== source.ownerItemUid)
		.sort((left, right) => Order.String(left, right))
		.map((itemUid) => ({
			fromItemUid: itemUid,
			role: "input" as const,
			source,
			toItemUid: source.ownerItemUid,
		})),
	...source.outputs.map((output, outcomeIndex) => ({
		fromItemUid: source.ownerItemUid,
		outcomeIndex,
		role: "output" as const,
		source,
		toItemUid: output.itemUid,
	})),
];

/** Projects the exact item-to-item edges materialized by the origin flow. */
export const readItemOriginRelationsFn = (source: ItemOriginSource) =>
	projectItemOriginRelationsFn(source);
