import type { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import type { ItemId } from "~/manifest/manifestId";

export const groupCraftInputRows = (rows: readonly ItemInstanceRowSchema.Type[]) => {
	const byOwner = new Map<string, Map<ItemId, number>>();

	for (const row of rows) {
		if (!row.ownerItemInstanceId) continue;

		const itemId = row.itemDefinitionId as ItemId;
		const owner = byOwner.get(row.ownerItemInstanceId) ?? new Map<ItemId, number>();
		owner.set(itemId, (owner.get(itemId) ?? 0) + row.quantity);
		byOwner.set(row.ownerItemInstanceId, owner);
	}

	return byOwner;
};
