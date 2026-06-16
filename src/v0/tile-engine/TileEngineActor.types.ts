import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";

export namespace TileEngineActor {
	export interface DragSession<TDrag = unknown> {
		pointerId: number;
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
		origin: TileEngine.Rect;
		source: TDrag;
		started: boolean;
		longFired: boolean;
	}

	export interface LastTap {
		time: number;
		x: number;
		y: number;
	}

	export interface Handoff {
		tileId: string;
		targetSlotId: string;
	}

	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		tile: TileEngine.Tile<TTile>;
		index: number;
		columns: number;
		rowCount: number;
		gapPx: number;
		enter?: TileEnterMotionSchema.Type;
		exit?: TileExitMotionSchema.Type;
		drag?: TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		dropFeedback: TileEngine.ActiveDropFeedback | null;
		setActiveDropId(dropId: string | null): void;
		setActiveDropFeedback(feedback: TileEngine.ActiveDropFeedback | null): void;
		setHandoff(handoff: Handoff | null): void;
		setHandoffs(handoffs: readonly Handoff[]): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
		renderTile(props: TileEngine.RenderTileProps<TTile>): ReactNode;
	}

	export interface DragHandlers {
		dragging: boolean;
		handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void;
		handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void;
		handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void;
		handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>): void;
	}
}
