import type { ItemId } from "~/config/IdSchema";
import type { Feedback } from "~/play/feedback/Feedback";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

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
				assetProgress?: number;
				kind: "static-item";
				itemId: ItemId;
				quantity?: number;
		  };
}
