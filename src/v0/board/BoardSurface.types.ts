import type { ItemId } from "~/v0/manifest/manifestId";
import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace BoardSurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onOpenItem(boardItemId: string): void;
		disabled?: boolean;
	}

	export type TileData =
		| {
				kind: "board-item";
				boardItemId: string;
		  }
		| {
				kind: "static-item";
				itemId: ItemId;
		  };
}
