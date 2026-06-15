import type { BoardView } from "~/board/view/BoardViewSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";

export interface OptimisticSnapshot {
	board?: BoardView;
	inventory?: InventoryView;
}
