import { memo, type FC } from "react";
import { type useInventoryTileEngine as useInventoryTileEngineType } from "~/inventory/hook/useInventoryTileEngine";
import { useInventorySheetController } from "~/inventory/hook/useInventorySheetController";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { DragData, DropData } from "~/play/types";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace InventorySheet {
	export interface Props {}
}

export const InventorySheet: FC<InventorySheet.Props> = memo(() => {
	const controller = useInventorySheetController();
	const engine = controller.engine;

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Inventory"
				description={`${engine.filled}/${engine.slotCount} slots`}
				anchor="inventory-summary"
				onClose={controller.onClose}
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
					activeDropTargetNodeId={engine.activeDropTargetNodeId}
					drag={engine.dragConfig}
					renderSlot={engine.renderSlot}
					renderTile={engine.renderTile}
				/>
			</div>
		</div>
	);
});
