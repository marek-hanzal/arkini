import { memo, useState } from "react";
import { cn } from "~/v0/style/cn";
import { TileEngineActors } from "~/v0/tile-engine/TileEngineActors";
import { TileEngineSlots } from "~/v0/tile-engine/TileEngineSlots";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";
import { useTileEngineDrops } from "~/v0/tile-engine/useTileEngineDrops";
import { useTileEngineHandoff } from "~/v0/tile-engine/useTileEngineHandoff";
import { useTileEngineIndexes } from "~/v0/tile-engine/useTileEngineIndexes";

export type { TileEngine as TileEngineNamespace } from "~/v0/tile-engine/TileEngine.types";

const TileEngineComponent = <TTile, TSlot, TDrag, TDrop>({
	id,
	columns,
	slots,
	tiles,
	className,
	cellClassName,
	itemLayerClassName,
	gapPx = TileEngineTiming.defaultGapPx,
	drag,
	dragConstraintsRef,
	renderSlot,
	renderTile,
}: TileEngineType.Props<TTile, TSlot, TDrag, TDrop>) => {
	const [activeDropId, setActiveDropId] = useState<string | null>(null);
	const indexes = useTileEngineIndexes({
		columns,
		slots,
		tiles,
	});
	const drops = useTileEngineDrops<TSlot, TTile, TDrop>();
	const handoff = useTileEngineHandoff();

	return (
		<div
			data-ak-tile-engine-id={id}
			className={cn("relative overflow-hidden", className)}
		>
			<TileEngineSlots
				columns={columns}
				gapPx={gapPx}
				slots={slots}
				tileBySlotId={indexes.tileBySlotId}
				activeDropId={activeDropId}
				cellClassName={cellClassName}
				drag={drag}
				renderSlot={renderSlot}
				registerDrop={drops.registerDrop}
			/>

			<TileEngineActors
				tiles={tiles}
				slotIndexById={indexes.slotIndexById}
				columns={columns}
				rowCount={indexes.rowCount}
				gapPx={gapPx}
				itemLayerClassName={itemLayerClassName}
				drag={drag}
				dragConstraintsRef={dragConstraintsRef}
				resolveDrop={drops.resolveDrop}
				setActiveDropId={setActiveDropId}
				setHandoff={handoff.setHandoff}
				consumeHandoff={handoff.consumeHandoff}
				renderTile={renderTile}
			/>
		</div>
	);
};

export const TileEngine = memo(TileEngineComponent) as typeof TileEngineComponent;
