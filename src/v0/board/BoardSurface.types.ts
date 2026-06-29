import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace BoardSurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onOpenItem(boardItemId: string): void;
		onOpenCheatInventory(): void;
		onOpenInventory(): void;
		onOpenInventoryPlacementTarget(cell: { x: number; y: number }): void;
		onOpenNukeSave(): void;
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
