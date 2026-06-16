import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";

export namespace CacheSnapshot {
	export interface Type {
		board?: BoardView;
		inventory?: InventoryView;
		boardTransientMergeGroupIds?: readonly string[];
	}
}
