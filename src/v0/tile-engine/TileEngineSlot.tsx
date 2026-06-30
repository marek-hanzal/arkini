import { memo, useEffect, useRef } from "react";
import { cn } from "~/v0/ui/cn";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { sameTileEngineSlotProps } from "~/v0/tile-engine/sameTileEngineSlotProps";
import type { TileEngineSlot as TileEngineSlotType } from "~/v0/tile-engine/TileEngineSlot.types";
import { readTileEngineSlotVisibleFeedback } from "~/v0/tile-engine/readTileEngineSlotVisibleFeedback";
import { useTileSlotLongPress } from "~/v0/tile-engine/useTileSlotLongPress";

const dropFeedbackOverlayClassName = (feedback: TileEngine.ActiveDropFeedback | null): string => {
	if (!feedback) return "opacity-0";
	if (feedback.effect === "blocked") {
		return "bg-ak-danger/15 opacity-100 outline-ak-danger/30";
	}
	if (feedback.effect === "empty") {
		return "bg-pink-400/20 opacity-100 outline-ak-primary/30";
	}
	if (feedback.effect === "merge" && feedback.variant === "secondary") {
		return "bg-ak-success/20 opacity-100 outline-ak-success/30";
	}
	if (feedback.effect === "merge") {
		return "bg-pink-400/20 opacity-100 outline-ak-primary/40";
	}

	return "opacity-0";
};

const TileEngineSlotComponent = <TTile, TSlot, TDrop>({
	layerRole,
	slot,
	index,
	targetTile,
	dropFeedback,
	disabled: engineDisabled = false,
	className,
	dragRef,
	renderSlot,
	registerDrop,
}: TileEngineSlotType.Props<TTile, TSlot, TDrop>) => {
	const ref = useRef<HTMLDivElement | null>(null);
	const binding = dragRef.current?.slot(slot, targetTile);
	const dropId = binding?.id ?? slot.dropId ?? slot.id;
	const disabled = Boolean(engineDisabled || !binding || binding.disabled || slot.disabled);
	const slotFeedback = disabled
		? null
		: readTileEngineSlotVisibleFeedback({
				dropFeedback,
				targetTile,
			});
	const isOver = Boolean(slotFeedback);

	const longPress = useTileSlotLongPress({
		disabled,
		onLongActivate: binding?.onLongActivate,
	});

	useEffect(() => {
		if (disabled || !binding || !ref.current) return;

		return registerDrop({
			dropId,
			slot,
			targetTile,
			payload: binding.data,
			element: ref.current,
		});
	}, [
		binding,
		disabled,
		dropId,
		registerDrop,
		slot,
		targetTile,
	]);

	return (
		<div
			ref={ref}
			data-ak-tile-engine-slot-id={slot.id}
			data-ak-tile-engine-drop-id={disabled ? undefined : dropId}
			data-ak-tile-engine-drop-feedback={slotFeedback?.effect}
			data-ak-tile-engine-drop-feedback-variant={slotFeedback?.variant}
			className={cn(
				"relative",
				layerRole === "overlay" ? "[touch-action:pan-y]" : "touch-none",
				className,
			)}
			onPointerDown={longPress.onPointerDown}
			onPointerLeave={longPress.onPointerLeave}
			onPointerUp={longPress.onPointerUp}
			onPointerCancel={longPress.onPointerCancel}
		>
			{renderSlot({
				slot,
				index,
				isOver,
				dropFeedback: slotFeedback,
			})}
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-[0.12rem] rounded-[0.12rem] outline outline-1 -outline-offset-1 outline-transparent transition-[opacity,background-color,outline-color] duration-100 ease-out",
					dropFeedbackOverlayClassName(slotFeedback),
				)}
			/>
		</div>
	);
};

export const TileEngineSlot = memo(
	TileEngineSlotComponent,
	sameTileEngineSlotProps,
) as typeof TileEngineSlotComponent;
