import { type Dispatch, type RefObject, type SetStateAction } from "react";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { useTileDragHover } from "~/v0/tile-engine/useTileDragHover";
import { useTileDragLifecycle } from "~/v0/tile-engine/useTileDragLifecycle";
import { useTilePointerCancel } from "~/v0/tile-engine/useTilePointerCancel";
import { useTilePointerDown } from "~/v0/tile-engine/useTilePointerDown";
import { useTilePointerMove } from "~/v0/tile-engine/useTilePointerMove";
import { useTilePointerUp } from "~/v0/tile-engine/useTilePointerUp";

export namespace useTileActorDrag {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tileRef: RefObject<TileEngine.Tile<TTile>>;
		bindingRef: RefObject<TileEngine.DragBinding<TDrag> | undefined>;
		disabledRef: RefObject<boolean>;
		dragging: boolean;
		setDragging: Dispatch<SetStateAction<boolean>>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		longTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
		clearTimers(): void;
		clearLongTimer(): void;
		handleTap(event: { clientX: number; clientY: number }): void;
		animateBack(): Promise<void>;
		animateToTarget(targetRect: TileEngine.Rect | null): Promise<void>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		setActiveDropId(dropId: string | null): void;
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
	}
}

export const useTileActorDrag = <TTile, TSlot, TDrag, TDrop>({
	actorRef,
	dragSessionRef,
	tileRef,
	bindingRef,
	disabledRef,
	dragging,
	setDragging,
	dragRef,
	dragConstraintsRef,
	longTimerRef,
	clearTimers,
	clearLongTimer,
	handleTap,
	animateBack,
	animateToTarget,
	resolveDrop,
	setActiveDropId,
	setHandoff,
}: useTileActorDrag.Props<TTile, TSlot, TDrag, TDrop>): TileEngineActor.DragHandlers => {
	const updateHover = useTileDragHover({
		actorRef,
		dragSessionRef,
		dragRef,
		resolveDrop,
		setActiveDropId,
	});
	const lifecycle = useTileDragLifecycle({
		actorRef,
		dragSessionRef,
		tileRef,
		dragRef,
		clearTimers,
		setActiveDropId,
		setDragging,
		setHandoff,
	});
	const handlePointerDown = useTilePointerDown({
		actorRef,
		bindingRef,
		disabledRef,
		dragConstraintsRef,
		dragSessionRef,
		longTimerRef,
		clearTimers,
		setHandoff,
	});
	const handlePointerMove = useTilePointerMove({
		actorRef,
		dragSessionRef,
		clearLongTimer,
		startActualDrag: lifecycle.startActualDrag,
		updateHover,
	});
	const handlePointerUp = useTilePointerUp({
		actorRef,
		dragSessionRef,
		tileRef,
		dragRef,
		clearLongTimer,
		handleTap,
		animateBack,
		animateToTarget,
		resolveDrop,
		finishDrag: lifecycle.finishDrag,
		setActiveDropId,
		setHandoff,
	});
	const handlePointerCancel = useTilePointerCancel({
		dragSessionRef,
		cancelDrag: lifecycle.cancelDrag,
	});

	return {
		dragging,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handlePointerCancel,
	};
};
