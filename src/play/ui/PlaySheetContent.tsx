import type { FC } from "react";
import { InventorySheet } from "~/inventory/ui/InventorySheet";
import { ItemDetailSheet } from "~/item/ui/ItemDetailSheet";
import { DbStatusCard } from "~/play/ui/DbStatusCard";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import type { usePlayShellController } from "~/play/hook/usePlayShellController";
import { UpgradesSheet } from "~/upgrade/ui/UpgradesSheet";

export namespace PlaySheetContent {
	export interface Props {
		controller: ReturnType<typeof usePlayShellController>;
	}
}

export const PlaySheetContent: FC<PlaySheetContent.Props> = ({ controller }) => {
	if (controller.renderedSheet === "inventory") {
		return (
			<InventorySheet
				drag={controller.drag}
				invalidInventorySlot={controller.invalidInventorySlot}
				onClose={controller.closeSheet}
				onSlotDoubleActivate={controller.placeInventorySlot}
				visualMotions={controller.visualMotions}
			/>
		);
	}

	if (controller.renderedSheet === "upgrades") {
		return <UpgradesSheet onClose={controller.closeSheet} />;
	}

	if (controller.renderedSheet === "database") {
		return (
			<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
				<SheetHeader
					eyebrow="System"
					description="Local database"
					onClose={controller.closeSheet}
				/>
				<div className="p-4 pt-1">
					<DbStatusCard />
				</div>
			</section>
		);
	}

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<ItemDetailSheet
				boardItemId={controller.selectedBoardItemId}
				onClose={controller.closeSheet}
			/>
		</section>
	);
};
