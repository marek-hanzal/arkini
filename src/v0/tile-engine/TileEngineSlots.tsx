import { memo, type ReactNode } from "react";
import { TileEngineSlot } from "~/v0/tile-engine/TileEngineSlot";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineSlots {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		columns: number;
		gapPx: number;
		slots: readonly TileEngine.Slot<TSlot>[];
		tileBySlotId: ReadonlyMap<string, TileEngine.Tile<TTile>>;
		activeDropId: string | null;
		activeDropFeedback: TileEngine.ActiveDropFeedback | null;
		cellClassName?: string;
		drag?: TileEngine.DragConfig<TTile, TSlot, unknown, TDrop>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
		registerDrop(entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>): () => void;
	}
}

const TileEngineSlotsComponent = <TTile, TSlot, TDrop>({
	columns,
	gapPx,
	slots,
	tileBySlotId,
	activeDropId,
	activeDropFeedback,
	cellClassName,
	drag,
	renderSlot,
	registerDrop,
}: TileEngineSlots.Props<TTile, TSlot, TDrop>) => (
	<div
		data-ak-tile-engine-slots=""
		className="ak-tile-engine-slots grid h-full w-full"
		style={{
			gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
			gap: gapPx,
		}}
	>
		{slots.map((slot, index) => (
			<TileEngineSlot
				key={slot.id}
				slot={slot}
				index={index}
				targetTile={tileBySlotId.get(slot.id)}
				activeDropId={activeDropId}
				activeDropFeedback={activeDropFeedback}
				className={cellClassName}
				drag={drag}
				renderSlot={renderSlot}
				registerDrop={registerDrop}
			/>
		))}
	</div>
);

export const TileEngineSlots = memo(TileEngineSlotsComponent) as typeof TileEngineSlotsComponent;
