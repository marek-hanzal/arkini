import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace InventorySurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onClose(): void;
	}

	export interface TileData {
		slotIndex: number;
	}
}
