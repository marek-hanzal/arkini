import type { CSSProperties, ReactNode, RefObject } from "react";

interface TileEngineDropBinding<TDrop = unknown> {
	id?: string;
	data: TDrop;
	disabled?: boolean;
	onLongActivate?(): void;
}

export namespace TileEngine {
	export type Id = string;
	export type LayerRole = "base" | "overlay";
	export type DropAnimation = "parallel-swap" | "parallel-merge";
	export type DropOutcome =
		| "accept"
		| "reject"
		| "ignore"
		| {
				type: "accept";
				animation?: DropAnimation;
				commit?(): Promise<unknown> | unknown;
		  }
		| {
				type: "reject";
		  }
		| {
				type: "ignore";
		  };

	export interface Rect {
		left: number;
		top: number;
		width: number;
		height: number;
	}

	export interface Slot<TSlot = unknown> {
		id: Id;
		/**
		 * Stable DOM/drop registry id for this slot. Prefer this over returning a
		 * dynamic DropBinding id so hover feedback can be scoped before slot render.
		 */
		dropId?: Id;
		/**
		 * Adapter-owned equality token for slot renderer data. When provided,
		 * TileEngine memoization may reuse slot actors across equivalent data object
		 * instances instead of treating every derived snapshot as a render change.
		 */
		renderKey?: string | number;
		data: TSlot;
		disabled?: boolean;
	}

	export interface Tile<TTile = unknown> {
		id: Id;
		slotId: Id;
		/**
		 * Adapter-owned equality token for tile renderer data. When provided,
		 * TileEngine memoization may reuse actors across equivalent data object
		 * instances. Include every scalar value that renderTile needs directly from
		 * tile.data.
		 */
		renderKey?: string | number;
		data: TTile;
		hidden?: boolean;
		disabled?: boolean;
		style?: Omit<CSSProperties, "zIndex">;
	}

	export interface DragBinding<TDrag = unknown> {
		id?: Id;
		data: TDrag;
		disabled?: boolean;
		delaySingleWhenDouble?: boolean;
		onSingleActivate?(): void;
		onDoubleActivate?(): void;
		onLongActivate?(): void;
	}

	export type DropFeedbackVariant = "subtle" | "primary" | "secondary" | "danger";

	export interface DropFeedback {
		effect: "empty" | "merge" | "blocked";
		variant?: DropFeedbackVariant;
	}

	export interface ActiveDropFeedback extends DropFeedback {
		dropId: Id;
		targetTileId?: Id;
	}

	export interface DropContext<
		TTile = unknown,
		TSlot = unknown,
		TDrag = unknown,
		TDrop = unknown,
	> {
		source: TDrag;
		target: TDrop | null;
		sourceTile: Tile<TTile>;
		targetSlot: Slot<TSlot> | null;
		targetTile: Tile<TTile> | null;
		dragRect: Rect;
		targetRect: Rect | null;
	}

	export interface DragOverContext<
		TTile = unknown,
		TSlot = unknown,
		TDrag = unknown,
		TDrop = unknown,
	> {
		source: TDrag;
		target: TDrop | null;
		targetSlot: Slot<TSlot> | null;
		targetTile: Tile<TTile> | null;
		dropId: string | null;
	}

	export interface DragConfig<
		TTile = unknown,
		TSlot = unknown,
		TDrag = unknown,
		TDrop = unknown,
	> {
		tile(tile: Tile<TTile>): DragBinding<TDrag> | undefined;
		slot(
			slot: Slot<TSlot>,
			targetTile: Tile<TTile> | undefined,
		): TileEngineDropBinding<TDrop> | undefined;
		dropFeedback?(context: DragOverContext<TTile, TSlot, TDrag, TDrop>): DropFeedback | null;
		onDragStart?(context: { source: TDrag; tile: Tile<TTile>; rect: Rect }): void;
		onDragOver?(context: DragOverContext<TTile, TSlot, TDrag, TDrop>): void;
		onDrop?(
			context: DropContext<TTile, TSlot, TDrag, TDrop>,
		): DropOutcome | Promise<DropOutcome>;
		onDragCancel?(context: { source: TDrag; tile: Tile<TTile> }): void;
	}

	export interface RenderSlotProps<TSlot = unknown> {
		slot: Slot<TSlot>;
		index: number;
		isOver: boolean;
		dropFeedback: ActiveDropFeedback | null;
	}

	export interface RenderTileProps<TTile = unknown> {
		tile: Tile<TTile>;
		isDragging: boolean;
	}

	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		id: Id;
		columns: number;
		slots: readonly Slot<TSlot>[];
		tiles: readonly Tile<TTile>[];
		className?: string;
		cellClassName?: string;
		actorLayerClassName?: string;
		disabled?: boolean;
		layerRole?: LayerRole;
		container?: "responsive" | "static";
		gapPx?: number;
		rootRef?: RefObject<HTMLDivElement | null>;
		drag?: DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		renderSlot(props: RenderSlotProps<TSlot>): ReactNode;
		renderTile(props: RenderTileProps<TTile>): ReactNode;
	}
}
