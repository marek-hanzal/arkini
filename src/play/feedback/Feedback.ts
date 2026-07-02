import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace Feedback {
	export interface Type {
		pulseMergeCell(key: string | undefined): void;
		pulseBoardCellFeedback(
			key: string | undefined,
			variant: TileEngine.DropFeedbackVariant,
		): void;
		flashBoardCell(key: string | undefined): void;
		flashInventorySlot(slotIndex: number | undefined): void;
		showError(error: unknown): void;
	}
}
