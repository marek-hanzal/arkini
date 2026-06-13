import type { BoardCell } from "~/board/boardIdentity";
import type { BuildRecipeCost } from "~/manifest/data/build";
import type { BuildRecipeId, ItemId } from "~/manifest/data/manifestId";
import type { ProducerMode } from "~/manifest/data/producer";

export interface GameSaveView {
	id: string;
	boardWidth: number;
	boardHeight: number;
	inventorySlots: number;
}

export type ItemCatalogView = Record<string, ViewItem>;

export interface BoardView {
	items: BoardViewItem[];
	byId: Record<string, BoardViewItem>;
	byCellKey: Record<string, BoardViewItem>;
	firstEmptyCell: BoardCell | null;
}

export interface InventoryView {
	slots: InventorySlot[];
	bySlotIndex: Record<number, InventorySlot>;
	stacksByItemId: Record<string, InventorySlot[]>;
	firstEmptySlotIndex: number | null;
}

export interface PlayerInventoryView {
	resources: PlayerResourceView[];
	byId: Record<string, PlayerResourceView>;
}

export interface PlayerResourceView {
	id: string;
	code: string;
	name: string;
	description: string;
	symbol: string;
	quantity: number;
}

export interface BuildRecipeView {
	id: BuildRecipeId;
	blueprintItemId: ItemId;
	resultItemId: ItemId;
	costs: BuildRecipeCost[];
	canBuild: boolean;
}

export interface GameDragView {
	boardItemsById: Record<string, BoardViewItem>;
	inventoryBySlotIndex: Record<number, InventorySlot>;
}

export interface ViewItem {
	id: string;
	name: string;
	description: string;
	label?: string;
	assetSrc: string;
	maxStackSize: number;
	tags: string[];
	canProduce: boolean;
	producerTrigger: "click" | null;
	canMerge: boolean;
}

export interface BoardViewItem {
	id: string;
	itemId: string;
	x: number;
	y: number;
	state: BoardItemState;
	producer: ProducerView | null;
}

export interface InventorySlot {
	slotIndex: number;
	stack: {
		id: string;
		itemId: string;
		quantity: number;
	} | null;
}

export interface ProducerView {
	trigger: "click";
	mode: ProducerMode;
	cooldownMs: number | null;
	doubleClickBehavior: "exhaust" | null;
	cooldownUntil: string | null;
	remainingCharges: number | null;
}

export interface ProducerPlacement {
	kind: "board" | "inventory";
	itemId: ItemId;
	boardItemId?: string;
	x?: number;
	y?: number;
	slotIndex?: number;
}

export type ProducerDepletion =
	| {
			kind: "remove";
	  }
	| {
			kind: "replace";
			itemId: ItemId;
	  };

export interface ProducerDropResult {
	producerBoardItemId: string;
	placements: ProducerPlacement[];
	depletion: ProducerDepletion | null;
}

export interface BoardItemState {
	producer?: {
		cooldownUntil?: string | null;
		remainingCharges?: number | null;
	};
}

export class GameActionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GameActionError";
	}
}
