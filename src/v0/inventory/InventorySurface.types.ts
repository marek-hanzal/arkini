import type { ItemId } from "~/config/IdSchema";
import type { Feedback } from "~/play/feedback/Feedback";

export namespace InventorySurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onClose(): void;
		placementTarget?: {
			x: number;
			y: number;
		};
	}

	export interface SlotData {
		slotIndex: number;
	}

	export interface TileData {
		slotIndex: number;
		stackId: string;
		itemId: ItemId;
		quantity: number;
	}
}
