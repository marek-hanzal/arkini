import { memo, type FC } from "react";
import {
	useInventoryTileEngine,
	type useInventoryTileEngine as useInventoryTileEngineType,
} from "~/inventory/hook/useInventoryTileEngine";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { DragData, DropData } from "~/play/types";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace InventorySheet {
	export type DragState = useInventoryTileEngineType.DragState;

	export interface Props {
		drag: DragState;
		invalidInventorySlot?: number;
		onClose(): void;
		onSlotDoubleActivate(slot: InventorySlot): void;
		visualMotions: useInventoryTileEngineType.Props["visualMotions"];
	}
}

export const InventorySheet: FC<InventorySheet.Props> = memo((props) => {
	const engine = useInventoryTileEngine(props);

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Inventory"
				description={`${engine.filled}/${engine.slotCount} slots`}
				anchor="inventory-summary"
				onClose={props.onClose}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<TileEngine<
					useInventoryTileEngineType.InventoryTileData,
					InventorySlot,
					DragData,
					DropData
				>
					id="inventory"
					columns={inventoryColumns}
					slots={engine.slots}
					tiles={engine.tiles}
					gapPx={1}
					className="ak-game-width mx-auto border-l border-t border-slate-800"
					itemLayerClassName="pointer-events-none"
					activeDropTargetNodeId={props.drag.activeDropTargetNodeId ?? null}
					drag={engine.dragConfig}
					renderSlot={engine.renderSlot}
					renderTile={engine.renderTile}
				/>
			</div>
		</div>
	);
});
