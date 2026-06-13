import type { FC } from "react";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { usePlayPlayerInventory } from "~/play/hook/usePlayPlayerInventory";
import { PlayerInventoryCell } from "~/player/ui/PlayerInventoryCell";
import { PlayerInventoryTile } from "~/player/ui/PlayerInventoryTile";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace PlayerInventorySheet {
	export interface Props {
		onClose(): void;
	}
}

export const PlayerInventorySheet: FC<PlayerInventorySheet.Props> = ({ onClose }) => {
	const playerInventory = usePlayPlayerInventory().data;
	const items = usePlayItems().data;

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Player"
				description="Collected valuables and progression items"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto">
					<p className="mb-3 text-xs text-slate-400">
						Slots: {playerInventory?.slots.filter((slot) => slot.stack).length ?? 0}/
						{playerInventory?.capacity ?? 0}
					</p>
					<div className="grid grid-cols-6 gap-2">
						{playerInventory?.slots.map((slot) => {
							const item = slot.stack ? items?.[slot.stack.itemId] : undefined;
							return (
								<PlayerInventoryCell
									key={slot.slotIndex}
									slotIndex={slot.slotIndex}
								>
									{slot.stack && item ? (
										<PlayerInventoryTile
											slot={slot}
											item={item}
										/>
									) : null}
								</PlayerInventoryCell>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};
