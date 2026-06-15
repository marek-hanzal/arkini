import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace InventorySurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onClose(): void;
	}

	export interface TileData {
		slot: InventorySlot;
		item: ViewItem;
	}
}
