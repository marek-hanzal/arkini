import { memo, type ReactNode, useCallback, useRef } from "react";
import { InventoryCell } from "~/inventory/InventoryCell";
import type { InventorySurface as InventorySurfaceType } from "~/inventory/InventorySurface.types";
import { renderInventoryTile } from "~/inventory/renderInventoryTile";
import { useInventoryTileEngineModel } from "~/inventory/useInventoryTileEngineModel";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { SheetHeader } from "~/play/sheet/SheetHeader";
import { TileEngine } from "~/tile-engine";
import type { TileEngineNamespace as TileEngineType } from "~/tile-engine";

export const InventorySurface = memo(
	({ feedback, feedbackFlags, onClose, placementTarget }: InventorySurfaceType.Props) => {
		const inventoryTileEngineRef = useRef<HTMLDivElement | null>(null);
		const { columns, drag, slots, tiles } = useInventoryTileEngineModel({
			feedback,
			placementTarget,
		});
		const renderSlot = useCallback(
			({
				slot,
			}: TileEngineType.RenderSlotProps<InventorySurfaceType.SlotData>): ReactNode => (
				<InventoryCell
					slotIndex={slot.data.slotIndex}
					invalid={feedbackFlags.has(`inventory:error:${slot.data.slotIndex}`)}
				/>
			),
			[
				feedbackFlags,
			],
		);

		return (
			<div
				data-ui="inventory root"
				className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
			>
				<SheetHeader
					title="Inventory"
					onClose={onClose}
				/>
				<div
					data-ui="inventory body"
					className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
				>
					<div className="mx-auto w-full max-w-[460px]">
						<TileEngine<
							InventorySurfaceType.TileData,
							InventorySurfaceType.SlotData,
							DragSource,
							DropTarget
						>
							id="inventory"
							rootRef={inventoryTileEngineRef}
							columns={columns}
							slots={slots}
							tiles={tiles}
							gapPx={1}
							className="bg-ak-inventory"
							container="static"
							layerRole="overlay"
							actorLayerClassName="pointer-events-none"
							drag={drag}
							dragConstraintsRef={inventoryTileEngineRef}
							renderSlot={renderSlot}
							renderTile={renderInventoryTile}
						/>
					</div>
				</div>
			</div>
		);
	},
);
