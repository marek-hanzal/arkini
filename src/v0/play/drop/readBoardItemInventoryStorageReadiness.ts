import { isBoardViewItemRuntimeBusy } from "~/v0/board/logic/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/v0/board/logic/isBoardViewItemRuntimeStatePreserved";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";

export namespace readBoardItemInventoryStorageReadiness {
	export interface Props {
		config: GameConfig;
		inventory: InventoryView;
		sourceItem: BoardViewItem;
	}

	export type Result =
		| {
				canStore: true;
		  }
		| {
				canStore: false;
				reason: "busy" | "inventory_full" | "storage_restricted";
		  };
}

const hasStackCapacity = ({
	config,
	inventory,
	sourceItem,
}: readBoardItemInventoryStorageReadiness.Props): boolean => {
	const itemDefinition = config.items[sourceItem.itemId];
	if (!itemDefinition) return false;

	return inventory.slots.some((slot) => {
		if (!slot.stack) return true;

		return (
			slot.stack.itemId === sourceItem.itemId &&
			slot.stack.quantity < itemDefinition.maxStackSize
		);
	});
};

const hasInstanceCapacity = ({
	inventory,
}: Pick<readBoardItemInventoryStorageReadiness.Props, "inventory">): boolean =>
	inventory.slots.some((slot) => !slot.stack);

export const readBoardItemInventoryStorageReadiness = ({
	config,
	inventory,
	sourceItem,
}: readBoardItemInventoryStorageReadiness.Props): readBoardItemInventoryStorageReadiness.Result => {
	if (
		!isItemStorageAllowed({
			config,
			itemId: sourceItem.itemId,
			location: "inventory",
		})
	) {
		return {
			canStore: false,
			reason: "storage_restricted",
		};
	}

	if (isBoardViewItemRuntimeBusy(sourceItem)) {
		return {
			canStore: false,
			reason: "busy",
		};
	}

	const hasInventoryTarget = isBoardViewItemRuntimeStatePreserved(sourceItem)
		? hasInstanceCapacity({
				inventory,
			})
		: hasStackCapacity({
				config,
				inventory,
				sourceItem,
			});

	if (!hasInventoryTarget) {
		return {
			canStore: false,
			reason: "inventory_full",
		};
	}

	return {
		canStore: true,
	};
};
