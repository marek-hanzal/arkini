import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import type { Feedback } from "~/v0/play/Feedback";

export namespace InventorySurface {
	export interface Props {
		feedback: Feedback;
		hasFeedback(key: string): boolean;
		onClose(): void;
	}

	export interface TileData {
		slot: InventorySlot;
		item: ViewItem;
	}
}
