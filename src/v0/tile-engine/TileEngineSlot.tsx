import { memo, type ReactNode, type RefObject, useEffect, useRef } from "react";
import { cn } from "~/v0/ui/cn";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { sameTileEngineSlotProps } from "~/v0/tile-engine/sameTileEngineSlotProps";
import { useTileSlotFeedbackDebug } from "~/v0/tile-engine/useTileSlotFeedbackDebug";
import { useTileSlotLongPress } from "~/v0/tile-engine/useTileSlotLongPress";

export namespace TileEngineSlot {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		dropFeedback: TileEngine.ActiveDropFeedback | null;
		disabled?: boolean;
		className?: string;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, unknown, TDrop> | undefined>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
		registerDrop(entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>): () => void;
	}
}

const TileEngineSlotComponent = <TTile, TSlot, TDrop>({
	slot,
	index,
	targetTile,
	dropFeedback,
	disabled: engineDisabled = false,
	className,
	dragRef,
	renderSlot,
	registerDrop,
}: TileEngineSlot.Props<TTile, TSlot, TDrop>) => {
	const ref = useRef<HTMLDivElement | null>(null);
	const binding = dragRef.current?.slot(slot, targetTile);
	const dropId = binding?.id ?? slot.dropId ?? slot.id;
	const disabled = Boolean(engineDisabled || !binding || binding.disabled || slot.disabled);
	const slotFeedback = disabled ? null : dropFeedback;
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

	useTileSlotFeedbackDebug({
		ref,
		slotId: slot.id,
		dropId,
		isOver,
		slotFeedback,
		targetTile,
	});

	return (
		<div
			ref={ref}
			data-ak-tile-engine-slot-id={slot.id}
			data-ak-tile-engine-drop-id={disabled ? undefined : dropId}
			data-ak-tile-engine-drop-feedback={slotFeedback?.effect}
			data-ak-tile-engine-drop-feedback-variant={slotFeedback?.variant}
			className={cn("ak-tile-engine-slot", className)}
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
		</div>
	);
};

export const TileEngineSlot = memo(
	TileEngineSlotComponent,
	sameTileEngineSlotProps,
) as typeof TileEngineSlotComponent;
