import { memo, type ReactNode, useEffect, useRef } from "react";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineSlot {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		activeDropId: string | null;
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
	activeDropId,
	className,
	drag,
	renderSlot,
	registerDrop,
}: TileEngineSlot.Props<TTile, TSlot, TDrop>) => {
	const ref = useRef<HTMLDivElement | null>(null);
	const binding = drag?.slot(slot, targetTile);
	const dropId = binding?.id ?? slot.id;
	const disabled = !binding || binding.disabled || slot.disabled;

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

	return (
		<div
			ref={ref}
			data-ak-tile-engine-slot-id={slot.id}
			data-ak-tile-engine-drop-id={disabled ? undefined : dropId}
			className={className}
		>
			{renderSlot({
				slot,
				index,
				isOver: !disabled && activeDropId === dropId,
			})}
		</div>
	);
};

export const TileEngineSlot = memo(TileEngineSlotComponent) as typeof TileEngineSlotComponent;
