import { memo, type ReactNode, useEffect, useRef } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { cn } from "~/v0/ui/cn";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineSlot {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		dropFeedback: TileEngine.ActiveDropFeedback | null;
		disabled?: boolean;
		className?: string;
		drag?: TileEngine.DragConfig<TTile, TSlot, unknown, TDrop>;
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
	drag,
	renderSlot,
	registerDrop,
}: TileEngineSlot.Props<TTile, TSlot, TDrop>) => {
	const ref = useRef<HTMLDivElement | null>(null);
	const binding = drag?.slot(slot, targetTile);
	const dropId = binding?.id ?? slot.dropId ?? slot.id;
	const disabled = engineDisabled || !binding || binding.disabled || slot.disabled;
	const slotFeedback = disabled ? null : dropFeedback;
	const isOver = Boolean(slotFeedback);

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
			className={cn("ak-tile-engine-slot", className)}
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

export const TileEngineSlot = memo(TileEngineSlotComponent) as typeof TileEngineSlotComponent;
