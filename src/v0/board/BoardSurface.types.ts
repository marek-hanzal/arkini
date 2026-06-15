import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import type { Feedback } from "~/v0/play/Feedback";

export namespace BoardSurface {
	export interface Props {
		feedback: Feedback;
		hasFeedback(key: string): boolean;
		onOpenItem(boardItemId: string): void;
	}

	export interface TileData {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
	}
}
