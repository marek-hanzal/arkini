import type { IdSchema } from "~/engine/common/schema/IdSchema";

export const adjustLineNetMaximumOutputQuantity = (
	quantities: Map<IdSchema.Type, number>,
	itemId: IdSchema.Type,
	delta: number,
) => {
	const quantity = (quantities.get(itemId) ?? 0) + delta;
	if (quantity === 0) quantities.delete(itemId);
	else quantities.set(itemId, quantity);
};

export const clampLineNetMaximumOutputQuantities = (quantities: Map<IdSchema.Type, number>) => {
	for (const [itemId, quantity] of quantities) {
		if (quantity <= 0) quantities.delete(itemId);
	}
	return quantities;
};
