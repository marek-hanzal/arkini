import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { ActiveSheetState } from "~/v0/play/sheet/ActiveSheetState";

export namespace BoardSurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onOpenSheet(sheet: ActiveSheetState): void;
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
