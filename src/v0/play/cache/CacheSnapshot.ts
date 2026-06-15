import type { BoardView } from "~/board/view/BoardViewSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";

export namespace CacheSnapshot {
	export interface Type {
		board?: BoardView;
		inventory?: InventoryView;
	}
}
