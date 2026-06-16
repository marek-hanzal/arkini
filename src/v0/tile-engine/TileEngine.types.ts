import type { CSSProperties, ReactNode, RefObject } from "react";
import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";

export namespace TileEngine {
	export type Id = string;
	export type LayerRole = "base" | "overlay";
	export type TileStyle = Omit<CSSProperties, "zIndex">;
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
		data: TSlot;
		disabled?: boolean;
	}

	export interface Tile<TTile = unknown> {
		id: Id;
		slotId: Id;
		data: TTile;
		hidden?: boolean;
		disabled?: boolean;
		style?: TileStyle;
		enter?: TileEnterMotionSchema.Type;
		exit?: TileExitMotionSchema.Type;
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

	export type DropFeedbackEffect = "empty" | "merge" | "blocked";

	export interface DropFeedback {
		effect: DropFeedbackEffect;
	}

	export interface ActiveDropFeedback extends DropFeedback {
		dropId: Id;
		targetTileId?: Id;
	}

	export interface DropBinding<TDrop = unknown> {
		id?: Id;
		data: TDrop;
		disabled?: boolean;
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
		): DropBinding<TDrop> | undefined;
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
		gapPx?: number;
		drag?: DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		renderSlot(props: RenderSlotProps<TSlot>): ReactNode;
		renderTile(props: RenderTileProps<TTile>): ReactNode;
	}
}
