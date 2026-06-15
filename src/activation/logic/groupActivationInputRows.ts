import type { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import type { ItemId } from "~/manifest/manifestId";

export const groupActivationInputRows = (rows: readonly ItemInstanceRowSchema.Type[]) => {
	const grouped = new Map<string, Map<ItemId, number>>();

	for (const row of rows) {
		if (row.locationKind !== "activation-input" || !row.ownerItemInstanceId) continue;

		const owner = grouped.get(row.ownerItemInstanceId) ?? new Map<ItemId, number>();
		owner.set(row.itemDefinitionId, (owner.get(row.itemDefinitionId) ?? 0) + row.quantity);
		grouped.set(row.ownerItemInstanceId, owner);
	}

	return grouped;
};
