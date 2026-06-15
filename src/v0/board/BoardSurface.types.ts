import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { Feedback } from "~/v0/play/Feedback";

export namespace BoardSurface {
	export interface Props {
		feedback: Feedback;
		feedbackFlags: ReadonlySet<string>;
		onOpenItem(boardItemId: string): void;
	}

	export interface TileData {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
	}
}
