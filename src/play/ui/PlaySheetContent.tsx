import type { FC } from "react";
import { InventorySheet } from "~/inventory/ui/InventorySheet";
import { ItemDetailSheet } from "~/item/ui/ItemDetailSheet";
import { usePlaySheetContentController } from "~/play/hook/usePlaySheetContentController";
import { DbStatusCard } from "~/play/ui/DbStatusCard";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { UpgradesSheet } from "~/upgrade/ui/UpgradesSheet";

export namespace PlaySheetContent {
	export interface Props {}
}

export const PlaySheetContent: FC<PlaySheetContent.Props> = () => {
	const controller = usePlaySheetContentController();

    /**
     * GPT:FIX
     *
     * Are you kidding me???
     *
     * Really we've here if === sheet?
     *
     * Create standalone sheets for every sheet we're using, connect it to it's button.
     *
     * This kind of crap is not acceptable.
    */
	if (controller.renderedSheet === "inventory") {
		return <InventorySheet />;
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
