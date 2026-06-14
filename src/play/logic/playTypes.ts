import type { BoardCell } from "~/board/BoardCell";
import type { CraftRecipeInput } from "~/manifest/craft";
import type { ItemId } from "~/manifest/manifestId";

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

export interface UpgradeListView {
	upgrades: UpgradeView[];
}

export interface UpgradeView {
	id: string;
	code: string;
	name: string;
	description: string;
	level: number;
	maxLevel: number;
	maxed: boolean;
	inProgress: boolean;
	canBuy: boolean;
	startedAtMs?: number;
	readyAtMs?: number;
	progress?: number;
	nextCost: UpgradeCostView[];
	currentEffects: string[];
	nextEffects: string[];
}

export interface UpgradeCostView {
	itemId: string;
	quantity: number;
	available: number;
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
	assetOverlaySrc?: string;
	assetRender?: "plain" | "blueprint";
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
	usedInMerges?: {
		targetItemId: string;
		resultItemId: string;
		secret?: boolean;
	}[];
}

export interface BoardViewItem {
	id: string;
	itemId: string;
	x: number;
	y: number;
	state: BoardItemState;
	activation?: ActivationView;
	craft?: CraftProgressView;
}

export interface InventorySlot {
	slotIndex: number;
	stack?: {
		id: string;
		itemId: string;
		quantity: number;
		state: BoardItemState;
		stateJson: string;
		stateful: boolean;
	};
}

export type CraftProgressPhase = "collecting_inputs" | "waiting" | "ready";

export interface CraftProgressView {
	id: string;
	resultItemId: string;
	durationMs: number;
	inputs: CraftRecipeInput[];
	delivered: Record<string, number>;
	inputProgress: number;
	timeProgress: number;
	progress: number;
	phase: CraftProgressPhase;
	complete: boolean;
	canAcceptInputs: boolean;
	startedAtMs?: number;
	readyAtMs?: number;
	remainingMs?: number;
	acceptedInputItemIds: string[];
}

export interface ActivationView {
	kind: "producer" | "stash";
	trigger: "click";
	cooldownMs?: number;
	cooldownUntil?: string;
	cooldownUntilMs?: number;
	remainingCharges?: number;
	inputs: ActivationInputView[];
}

export interface ActivationInputView {
	itemId: string;
	quantity: number;
	capacity: number;
	stored: number;
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
	activation?: {
		cooldownUntil?: string;
		remainingCharges?: number;
		inventory?: Record<string, number>;
	};
	craft?: {
		delivered?: Record<string, number>;
		startedAt?: string;
		readyAt?: string;
		remainingMs?: number;
	};
}

export class GameActionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GameActionError";
	}
}
