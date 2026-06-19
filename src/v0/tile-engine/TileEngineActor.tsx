import { memo, useEffect, useRef, useState } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { cn } from "~/v0/ui/cn";
import { actorStyle } from "~/v0/tile-engine/actorStyle";
import type { TileEngineActor as TileEngineActorType } from "~/v0/tile-engine/TileEngineActor.types";
import { useTileActorDrag } from "~/v0/tile-engine/useTileActorDrag";
import { useTileActorEnterMotion } from "~/v0/tile-engine/useTileActorEnterMotion";
import { useTileActorExitMotion } from "~/v0/tile-engine/useTileActorExitMotion";
import { useTileActorMotion } from "~/v0/tile-engine/useTileActorMotion";
import { useTileActorTap } from "~/v0/tile-engine/useTileActorTap";
import { useTileActorTimers } from "~/v0/tile-engine/useTileActorTimers";
import { cancelTileMotionForElement } from "~/v0/tile-engine/TileMotionRuntime";
import { useLatestRef } from "~/v0/react/useLatestRef";
import { sameTileEngineActorProps } from "~/v0/tile-engine/sameTileEngineActorProps";
import { useTileActorFeedbackDebug } from "~/v0/tile-engine/useTileActorFeedbackDebug";

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
	enter,
	exit,
	dragRef,
	dragDisabled,
	dragConstraintsRef,
	resolveDrop,
	dropFeedback,
	setActiveDropId,
	setActiveDropFeedback,
	setHandoff,
	setHandoffs,
	consumeHandoff,
	renderTile,
}: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>) => {
	const actorRef = useRef<HTMLDivElement | null>(null);
	const dragSessionRef = useRef<TileEngineActorType.DragSession<TDrag> | null>(null);
	const initialTileRef = useRef({
		id: tile.id,
		slotId: tile.slotId,
	});
	const lastTapRef = useRef<TileEngineActorType.LastTap | null>(null);
	const timers = useTileActorTimers();
	const binding = dragRef.current?.tile(tile);
	const disabled = tile.disabled || tile.hidden || dragDisabled || binding?.disabled || !binding;
	const tileRef = useLatestRef(tile);
	const bindingRef = useLatestRef(binding);
	const disabledRef = useLatestRef(disabled);
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		const element = actorRef.current;
		const initialTile = initialTileRef.current;
		DebugTimeline.record({
			scope: "tile-engine",
			event: "actor.lifecycle.mount",
			detail: {
				tileId: initialTile.id,
				slotId: initialTile.slotId,
			},
		});

		return () => {
			DebugTimeline.record({
				scope: "tile-engine",
				event: "actor.lifecycle.unmount",
				detail: {
					tileId: initialTile.id,
					slotId: initialTile.slotId,
				},
			});
			cancelTileMotionForElement(element, "actor-unmount");
		};
	}, []);
	useTileActorEnterMotion({
		actorRef,
		enter,
		tileId: tile.id,
	});
	useTileActorExitMotion({
		actorRef,
		exit,
		tileId: tile.id,
	});

	useTileActorFeedbackDebug({
		actorRef,
		dragging,
		dropFeedback,
		tileId: tile.id,
		slotId: tile.slotId,
	});

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
		setActiveDropFeedback,
		setHandoff,
		setHandoffs,
	});

	return (
		<div
			ref={actorRef}
			data-ak-tile-engine-tile-id={tile.id}
			data-ak-tile-engine-slot-id={tile.slotId}
			data-ak-tile-engine-dragging={dragging ? "true" : undefined}
			data-ak-tile-engine-drop-feedback={dropFeedback?.effect}
			data-ak-tile-engine-drop-feedback-variant={dropFeedback?.variant}
			className={cn(
				"ak-tile-engine-actor pointer-events-auto absolute touch-none select-none will-change-transform",
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
				...tile.style,
			}}
			onPointerDown={dragHandlers.handlePointerDown}
			onPointerMove={dragHandlers.handlePointerMove}
			onPointerUp={dragHandlers.handlePointerUp}
			onPointerCancel={dragHandlers.handlePointerCancel}
		>
			<div
				data-ak-tile-engine-visual="true"
				className="ak-tile-engine-visual"
			>
				{renderTile({
					tile,
					isDragging: dragging,
				})}
			</div>
		</div>
	);
};

export const TileEngineActor = memo(
	TileEngineActorComponent,
	sameTileEngineActorProps,
) as typeof TileEngineActorComponent;
