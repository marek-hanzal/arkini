import { useMemo, type FC } from "react";
import type { Command } from "~/action/command";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { PhaserInventory } from "~/phaser/inventory/PhaserInventory";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayInventory } from "~/play/hook/usePlayInventory";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { InventorySlot } from "~/play/logic/playTypes";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace InventorySheet {
	export interface Props {
		onClose(): void;
	}
}

export const InventorySheet: FC<InventorySheet.Props> = ({ onClose }) => {
	const inventory = usePlayInventory().data;
	const items = usePlayItems().data;
	const board = usePlayBoard().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand<Command>({
		invalidateOnSuccess: false,
	});

	const handlers = useMemo(
		() =>
			({
				async swap(source: InventorySlot, target: InventorySlot) {
					await command.mutateAsync({
						type: "inventory.swap",
						sourceSlotIndex: source.slotIndex,
						targetSlotIndex: target.slotIndex,
					});
					await invalidatePlayData([
						"inventory",
						"databaseStatus",
					]);
				},
				async place(slot: InventorySlot) {
					const target = board?.firstEmptyCell;
					if (!slot.stack || !target) throw new Error("No free board cell available.");
					await command.mutateAsync({
						type: "inventory.place",
						slotIndex: slot.slotIndex,
						x: target.x,
						y: target.y,
					});
					await invalidatePlayData([
						"board",
						"inventory",
						"databaseStatus",
					]);
				},
			}) satisfies PhaserInventory.Handlers,
		[
			board?.firstEmptyCell,
			command,
			invalidatePlayData,
		],
	);

	if (!inventory || !items) return null;

	const filled = inventory.slots.filter((slot) => slot.stack).length;
	const rowCount = Math.ceil(inventory.slots.length / inventoryColumns);

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Inventory"
				description={`${filled}/${inventory.slots.length} slots · drag to reorder, double tap to place`}
				anchor="inventory-summary"
				onClose={onClose}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div
					className="ak-game-width relative mx-auto overflow-hidden rounded-md border border-slate-800 bg-slate-950/80 shadow-xl shadow-slate-950/30"
					style={{
						aspectRatio: `${inventoryColumns} / ${rowCount}`,
					}}
				>
					<PhaserInventory
						inventory={inventory}
						items={items}
						handlers={handlers}
					/>
				</div>
			</div>
		</div>
	);
};
