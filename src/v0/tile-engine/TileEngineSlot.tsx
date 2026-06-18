import {
	memo,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { cn } from "~/v0/ui/cn";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import { sameTileEngineSlot } from "~/v0/tile-engine/sameTileEngineSlot";
import { sameTileEngineTile } from "~/v0/tile-engine/sameTileEngineTile";

const sameActiveDropFeedback = (
	left: TileEngine.ActiveDropFeedback | null,
	right: TileEngine.ActiveDropFeedback | null,
) =>
	left?.dropId === right?.dropId &&
	left?.effect === right?.effect &&
	left?.variant === right?.variant &&
	left?.targetTileId === right?.targetTileId;

const sameOptionalTileEngineTile = <TTile,>(
	left: TileEngine.Tile<TTile> | undefined,
	right: TileEngine.Tile<TTile> | undefined,
) => {
	if (!left || !right) return left === right;

	return sameTileEngineTile(left, right);
};

const sameTileEngineSlotProps = <TTile, TSlot, TDrop>(
	left: TileEngineSlot.Props<TTile, TSlot, TDrop>,
	right: TileEngineSlot.Props<TTile, TSlot, TDrop>,
) =>
	sameTileEngineSlot(left.slot, right.slot) &&
	left.index === right.index &&
	sameOptionalTileEngineTile(left.targetTile, right.targetTile) &&
	sameActiveDropFeedback(left.dropFeedback, right.dropFeedback) &&
	left.disabled === right.disabled &&
	left.className === right.className &&
	left.dragRef === right.dragRef &&
	left.renderSlot === right.renderSlot &&
	left.registerDrop === right.registerDrop;

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
	const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const activePointerIdRef = useRef<number | null>(null);
	const binding = dragRef.current?.slot(slot, targetTile);
	const dropId = binding?.id ?? slot.dropId ?? slot.id;
	const disabled = engineDisabled || !binding || binding.disabled || slot.disabled;
	const slotFeedback = disabled ? null : dropFeedback;
	const isOver = Boolean(slotFeedback);

	const clearLongTimer = useCallback(() => {
		if (!longTimerRef.current) return;
		clearTimeout(longTimerRef.current);
		longTimerRef.current = null;
	}, []);

	const handlePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (disabled || !binding?.onLongActivate || event.button !== 0) return;
			activePointerIdRef.current = event.pointerId;
			clearLongTimer();
			longTimerRef.current = setTimeout(() => {
				if (activePointerIdRef.current !== event.pointerId) return;
				longTimerRef.current = null;
				binding.onLongActivate?.();
			}, TileEngineTiming.longPressMs);
		},
		[
			binding,
			clearLongTimer,
			disabled,
		],
	);

	const cancelPointerLongPress = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (activePointerIdRef.current !== event.pointerId) return;
			activePointerIdRef.current = null;
			clearLongTimer();
		},
		[
			clearLongTimer,
		],
	);

	useEffect(
		() => () => {
			activePointerIdRef.current = null;
			clearLongTimer();
		},
		[
			clearLongTimer,
		],
	);

	useEffect(() => {
		if (disabled || !ref.current) return;

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

	useEffect(() => {
		if (!slotFeedback) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "slot.feedback.render",
			detail: {
				slotId: slot.id,
				dropId,
				isOver,
				feedback: slotFeedback,
				targetTileId: targetTile?.id,
				slotDataset: ref.current
					? {
							dropFeedback: ref.current.dataset.akTileEngineDropFeedback,
							dropFeedbackVariant:
								ref.current.dataset.akTileEngineDropFeedbackVariant,
						}
					: null,
			},
		});
	}, [
		dropId,
		slot.id,
		slotFeedback,
		targetTile?.id,
	]);

	return (
		<div
			ref={ref}
			data-ak-tile-engine-slot-id={slot.id}
			data-ak-tile-engine-drop-id={disabled ? undefined : dropId}
			data-ak-tile-engine-drop-feedback={slotFeedback?.effect}
			data-ak-tile-engine-drop-feedback-variant={slotFeedback?.variant}
			className={cn("ak-tile-engine-slot", className)}
			onPointerDown={handlePointerDown}
			onPointerLeave={cancelPointerLongPress}
			onPointerUp={cancelPointerLongPress}
			onPointerCancel={cancelPointerLongPress}
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
