import { type Dispatch, type RefObject, type SetStateAction } from "react";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { useTileDragHover } from "~/tile-engine/useTileDragHover";
import { useTileDragLifecycle } from "~/tile-engine/useTileDragLifecycle";
import { useTilePointerCancel } from "~/tile-engine/useTilePointerCancel";
import { useTilePointerDown } from "~/tile-engine/useTilePointerDown";
import { useTilePointerMove } from "~/tile-engine/useTilePointerMove";
import { useTilePointerUp } from "~/tile-engine/useTilePointerUp";

export namespace useTileActorDrag {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown>
		extends Omit<useTilePointerUp.Props<TTile, TSlot, TDrag, TDrop>, "finishDrag"> {
		bindingRef: RefObject<TileEngine.DragBinding<TDrag> | undefined>;
		disabledRef: RefObject<boolean>;
		dragging: boolean;
		setDragging: Dispatch<SetStateAction<boolean>>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		longTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
		clearTimers(): void;
		setActiveDropFeedback(feedback: TileEngine.ActiveDropFeedback | null): void;
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
	setActiveDropFeedback,
	setHandoff,
	setHandoffs,
}: useTileActorDrag.Props<TTile, TSlot, TDrag, TDrop>): TileEngineActor.DragHandlers => {
	const updateHover = useTileDragHover({
		actorRef,
		dragSessionRef,
		dragRef,
		resolveDrop,
		setActiveDropId,
		setActiveDropFeedback,
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
		tileRef,
		disabledRef,
		dragRef,
		dragConstraintsRef,
		dragSessionRef,
		longTimerRef,
		clearTimers,
		setHandoff,
	});
	const handlePointerMove = useTilePointerMove({
		actorRef,
		dragSessionRef,
		dragConstraintsRef,
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
		setHandoffs,
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
