import type { ItemId } from "~/v0/manifest/manifestId";
import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace InventorySurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onClose(): void;
	}

	export interface TileData {
		slotIndex: number;
		stackId: string;
		itemId: ItemId;
		quantity: number;
	}
}
