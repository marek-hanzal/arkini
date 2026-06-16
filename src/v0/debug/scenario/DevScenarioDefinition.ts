import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import type { ItemId } from "~/v0/manifest/manifestId";

export namespace DevScenarioDefinition {
	export interface BoardItem {
		id: string;
		itemId: ItemId;
		x: number;
		y: number;
		state?: BoardItemState;
	}

	export interface InventoryStack {
		id: string;
		itemId: ItemId;
		slotIndex: number;
		quantity: number;
		state?: BoardItemState;
	}

	export interface Type {
		id: string;
		label: string;
		description: string;
		board: readonly BoardItem[];
		inventory: readonly InventoryStack[];
	}
}

export type DevScenarioDefinition = DevScenarioDefinition.Type;
