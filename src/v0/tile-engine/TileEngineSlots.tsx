import { memo, type ReactNode, type RefObject } from "react";
import { cn } from "~/v0/ui/cn";
import { TileEngineSlot } from "~/v0/tile-engine/TileEngineSlot";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineSlots {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		layerRole: TileEngine.LayerRole;
		columns: number;
		rowCount: number;
		gapPx: number;
		slots: readonly TileEngine.Slot<TSlot>[];
		tileBySlotId: ReadonlyMap<string, TileEngine.Tile<TTile>>;
		activeDropId: string | null;
		activeDropFeedback: TileEngine.ActiveDropFeedback | null;
		cellClassName?: string;
		disabled?: boolean;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, unknown, TDrop> | undefined>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
		registerDrop(entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>): () => void;
	}
}

const TileEngineSlotsComponent = <TTile, TSlot, TDrop>({
	layerRole,
	columns,
	rowCount,
	gapPx,
	slots,
	tileBySlotId,
	activeDropId,
	activeDropFeedback,
	cellClassName,
	disabled = false,
	dragRef,
	renderSlot,
	registerDrop,
}: TileEngineSlots.Props<TTile, TSlot, TDrop>) => (
	<div
		data-ak-tile-engine-slots=""
		className={cn(
			"grid h-full w-full",
			layerRole === "overlay" ? "[touch-action:pan-y]" : "touch-none",
		)}
		style={{
			zIndex: "var(--ak-layer-base-surface)",
			gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
			gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
			gap: gapPx,
		}}
	>
		{slots.map((slot, index) => {
			const dropId = slot.dropId ?? slot.id;
			const slotDropFeedback =
				activeDropFeedback?.dropId === activeDropId && activeDropFeedback.dropId === dropId
					? activeDropFeedback
					: null;

			return (
				<TileEngineSlot
					key={slot.id}
					layerRole={layerRole}
					slot={slot}
					index={index}
					targetTile={tileBySlotId.get(slot.id)}
					dropFeedback={slotDropFeedback}
					disabled={disabled}
					className={cellClassName}
					dragRef={dragRef}
					renderSlot={renderSlot}
					registerDrop={registerDrop}
				/>
			);
		})}
	</div>
);

export const TileEngineSlots = memo(TileEngineSlotsComponent) as typeof TileEngineSlotsComponent;
