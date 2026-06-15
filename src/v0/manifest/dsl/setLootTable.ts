import type { ItemId, LootTableId } from "../manifestId";
import type { UpgradeEffectDefinition } from "~/v0/manifest/upgrade/UpgradeEffectDefinition";

export namespace setLootTable {
	export interface Props {
		itemId: ItemId;
		tableId: LootTableId;
	}
}

export const setLootTable = (props: setLootTable.Props): UpgradeEffectDefinition => {
	const { itemId, tableId } = props;

	return {
		type: "producer.outputTable.set",
		itemId,
		tableId,
	};
};
