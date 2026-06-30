import { memo, useEffect, useRef, useState } from "react";
import { DebugTimeline } from "~/v0/diagnostics/DebugTimeline";
import { cn } from "~/v0/ui/cn";
import { actorStyle } from "~/v0/tile-engine/actorStyle";
import type { TileEngineActor as TileEngineActorType } from "~/v0/tile-engine/TileEngineActor.types";
import { useTileActorDrag } from "~/v0/tile-engine/useTileActorDrag";
import { useTileActorEnterMotion } from "~/v0/tile-engine/useTileActorEnterMotion";
import { useTileActorExitMotion } from "~/v0/tile-engine/useTileActorExitMotion";
import { useTileActorFeedbackMotion } from "~/v0/tile-engine/useTileActorFeedbackMotion";
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
	layerRole,
	tile,
	index,
	columns,
	rowCount,
	gapPx,
	enter,
	exit,
	feedback,
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
	useTileActorFeedbackMotion({
		actorRef,
		feedback,
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

	const isOverlayLayer = layerRole === "overlay";

	return (
		<div
			ref={actorRef}
			data-ak-tile-engine-tile-id={tile.id}
			data-ak-tile-engine-slot-id={tile.slotId}
			data-ak-tile-engine-dragging={dragging ? "true" : undefined}
			data-ak-tile-engine-drop-feedback={dropFeedback?.effect}
			data-ak-tile-engine-drop-feedback-variant={dropFeedback?.variant}
			className={cn(
				"pointer-events-auto absolute select-none will-change-transform",
				isOverlayLayer ? "[touch-action:pan-y]" : "touch-none",
				tile.hidden && "pointer-events-none opacity-0",
				disabled && "pointer-events-none",
			)}
			style={{
				zIndex: dragging
					? isOverlayLayer
						? "var(--ak-layer-overlay-drag-tile)"
						: "var(--ak-layer-base-drag-tile)"
					: isOverlayLayer
						? "var(--ak-layer-overlay-tile)"
						: "var(--ak-layer-base-tile)",
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
				className={cn(
					"h-full w-full origin-center transition-[transform,filter,opacity] duration-150 ease-out will-change-[transform,opacity] [backface-visibility:hidden] data-[ak-tile-engine-presence-motion]:transition-none",
					isOverlayLayer ? "[touch-action:pan-y]" : "touch-none",
					dropFeedback?.effect === "merge" &&
						"scale-[1.1] saturate-[1.08] brightness-[1.1]",
					dropFeedback?.effect === "blocked" &&
						"scale-[0.9] opacity-70 saturate-[0.78] brightness-[0.82]",
				)}
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
