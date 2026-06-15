import { memo, useRef, useState } from "react";
import { cn } from "~/shared/cn";
import { actorStyle } from "~/v0/tile-engine/actorStyle";
import type { TileEngineActor as TileEngineActorType } from "~/v0/tile-engine/TileEngineActor.types";
import { useTileActorDrag } from "~/v0/tile-engine/useTileActorDrag";
import { useTileActorMotion } from "~/v0/tile-engine/useTileActorMotion";
import { useTileActorTap } from "~/v0/tile-engine/useTileActorTap";
import { useTileActorTimers } from "~/v0/tile-engine/useTileActorTimers";
import { useLatestRef } from "~/v0/tile-engine/useLatestRef";

export namespace TileEngineActor {
	export type Props<
		TTile = unknown,
		TSlot = unknown,
		TDrag = unknown,
		TDrop = unknown,
	> = TileEngineActorType.Props<TTile, TSlot, TDrag, TDrop>;
}

const TileEngineActorComponent = <TTile, TSlot, TDrag, TDrop>({
	tile,
	index,
	columns,
	rowCount,
	gapPx,
	drag,
	dragConstraintsRef,
	resolveDrop,
	setActiveDropId,
	setHandoff,
	consumeHandoff,
	renderTile,
}: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>) => {
	const actorRef = useRef<HTMLDivElement | null>(null);
	const dragSessionRef = useRef<TileEngineActorType.DragSession<TDrag> | null>(null);
	const lastTapRef = useRef<TileEngineActorType.LastTap | null>(null);
	const timers = useTileActorTimers();
	const binding = drag?.tile(tile);
	const disabled = tile.disabled || tile.hidden || binding?.disabled || !binding;
	const tileRef = useLatestRef(tile);
	const bindingRef = useLatestRef(binding);
	const disabledRef = useLatestRef(disabled);
	const dragRef = useLatestRef(drag);
	const [dragging, setDragging] = useState(false);

	const tap = useTileActorTap({
		bindingRef,
		lastTapRef,
		singleTimerRef: timers.singleTimerRef,
		clearSingleTimer: timers.clearSingleTimer,
	});
	const motion = useTileActorMotion({
		actorRef,
		dragSessionRef,
		tile,
		dragging,
		consumeHandoff,
	});
	const dragHandlers = useTileActorDrag({
		actorRef,
		dragSessionRef,
		tileRef,
		bindingRef,
		disabledRef,
		dragging,
		setDragging,
		dragRef,
		dragConstraintsRef,
		longTimerRef: timers.longTimerRef,
		clearTimers: timers.clearTimers,
		clearLongTimer: timers.clearLongTimer,
		handleTap: tap,
		animateBack: motion.animateBack,
		animateToTarget: motion.animateToTarget,
		resolveDrop,
		setActiveDropId,
		setHandoff,
	});

	return (
		<div
			ref={actorRef}
			data-ak-tile-engine-tile-id={tile.id}
			data-ak-tile-engine-slot-id={tile.slotId}
			data-ak-tile-engine-dragging={dragging ? "true" : undefined}
			className={cn(
				"pointer-events-auto absolute touch-none select-none will-change-transform",
				tile.hidden && "pointer-events-none opacity-0",
				disabled && "pointer-events-none",
			)}
			style={{
				...actorStyle({
					columns,
					rowCount,
					index,
					gapPx,
				}),
				zIndex: dragging ? 30 : 10,
				...tile.style,
			}}
			onPointerDown={dragHandlers.handlePointerDown}
			onPointerMove={dragHandlers.handlePointerMove}
			onPointerUp={dragHandlers.handlePointerUp}
			onPointerCancel={dragHandlers.handlePointerCancel}
		>
			{renderTile({
				tile,
				isDragging: dragging,
			})}
		</div>
	);
};

export const TileEngineActor = memo(TileEngineActorComponent) as typeof TileEngineActorComponent;
