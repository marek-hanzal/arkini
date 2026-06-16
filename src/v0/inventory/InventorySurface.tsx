import { memo, type ReactNode, useCallback } from "react";
import { InventoryCell } from "~/v0/inventory/InventoryCell";
import type { InventorySurface as InventorySurfaceType } from "~/v0/inventory/InventorySurface.types";
import { inventoryColumns } from "~/v0/inventory/inventoryColumns";
import { renderInventoryTile } from "~/v0/inventory/renderInventoryTile";
import { useInventoryTileEngineModel } from "~/v0/inventory/useInventoryTileEngineModel";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { TileEngine } from "~/v0/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";

export const InventorySurface = memo(
	({ feedback, feedbackFlags, onClose, dragConstraintsRef }: InventorySurfaceType.Props) => {
		const { drag, filled, slots, tiles } = useInventoryTileEngineModel({
			feedback,
		});
		const renderSlot = useCallback(
			({ slot }: TileEngineType.RenderSlotProps<InventorySlot>): ReactNode => (
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
			<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
				<SheetHeader
					eyebrow="Inventory"
					description={`${filled}/${slots.length} slots`}
					onClose={onClose}
				/>
				<div className="min-h-0 flex-1 overflow-visible px-3 py-4">
					<TileEngine<
						InventorySurfaceType.TileData,
						InventorySlot,
						DragSource,
						DropTarget
					>
						id="inventory"
						columns={inventoryColumns}
						slots={slots}
						tiles={tiles}
						gapPx={1}
						className="ak-game-width mx-auto border-l border-t border-slate-800"
						layerRole="overlay"
						actorLayerClassName="pointer-events-none"
						drag={drag}
						dragConstraintsRef={dragConstraintsRef}
						renderSlot={renderSlot}
						renderTile={renderInventoryTile}
					/>
				</div>
			</div>
		);
	},
);
