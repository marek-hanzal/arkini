import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";

export interface GameEngineVisualPlanProps {
	currentBoard: BoardView | undefined;
	currentInventory: InventoryView | undefined;
	events: readonly GameEvent[];
	previousBoard: BoardView | undefined;
}
