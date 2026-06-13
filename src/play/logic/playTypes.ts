import type { BoardCell } from "~/board/boardIdentity";
import type { CraftRecipeInput } from "~/manifest/data/craft";
import type { ItemId } from "~/manifest/data/manifestId";
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
	firstEmptyCell?: BoardCell;
}

export interface InventoryView {
	slots: InventorySlot[];
	bySlotIndex: Record<number, InventorySlot>;
	stacksByItemId: Record<string, InventorySlot[]>;
	firstEmptySlotIndex?: number;
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
	producerTrigger?: "click";
	canMerge: boolean;
	mergeResults?: {
		withItemId: string;
		resultItemId: string;
		secret?: boolean;
	}[];
	usedInCrafts?: {
		targetItemId: string;
		resultItemId: string;
	}[];
}

export interface BoardViewItem {
	id: string;
	itemId: string;
	x: number;
	y: number;
	state: BoardItemState;
	producer?: ProducerView;
	craft?: CraftProgressView;
}

export interface InventorySlot {
	slotIndex: number;
	stack?: {
		id: string;
		itemId: string;
		quantity: number;
	};
}

export interface CraftProgressView {
	id: string;
	resultItemId: string;
	inputs: CraftRecipeInput[];
	delivered: Record<string, number>;
	progress: number;
	complete: boolean;
	acceptedInputItemIds: string[];
}

export interface ItemDetailView {
	boardItem?: BoardViewItem;
	item: ViewItem;
	mergeResults: {
		withItemId: string;
		resultItemId: string;
		secret?: boolean;
	}[];
	usedInCrafts: {
		targetItemId: string;
		resultItemId: string;
	}[];
}

export interface ProducerView {
	trigger: "click";
	mode: ProducerMode;
	cooldownMs?: number;
	doubleClickBehavior?: "exhaust";
	cooldownUntil?: string;
	cooldownUntilMs?: number;
	remainingCharges?: number;
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
	depletion?: ProducerDepletion;
}

export interface BoardItemState {
	producer?: {
		cooldownUntil?: string;
		remainingCharges?: number;
	};
	craft?: {
		delivered?: Record<string, number>;
	};
}

export class GameActionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GameActionError";
	}
}
