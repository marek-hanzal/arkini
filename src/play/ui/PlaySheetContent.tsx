import type { FC } from "react";
import { InventorySheet } from "~/inventory/ui/InventorySheet";
import { usePlaySheetContentController } from "~/play/hook/usePlaySheetContentController";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import { DatabaseSheet } from "~/play/ui/DatabaseSheet";
import { ItemSheet } from "~/play/ui/ItemSheet";
import { UpgradesSheet } from "~/upgrade/ui/UpgradesSheet";

export namespace PlaySheetContent {
	export interface Props {}
}

interface SheetProps {
	onClose(): void;
	boardItemId?: string;
}

const InventoryPlaySheet: FC<SheetProps> = () => <InventorySheet />;
const UpgradesPlaySheet: FC<SheetProps> = ({ onClose }) => <UpgradesSheet onClose={onClose} />;
const DatabasePlaySheet: FC<SheetProps> = ({ onClose }) => <DatabaseSheet onClose={onClose} />;
const ItemPlaySheet: FC<SheetProps> = ({ boardItemId, onClose }) => (
	<ItemSheet
		boardItemId={boardItemId}
		onClose={onClose}
	/>
);

const bottomSheetByType = {
	inventory: InventoryPlaySheet,
	upgrades: UpgradesPlaySheet,
	database: DatabasePlaySheet,
	item: ItemPlaySheet,
} satisfies Record<ActiveSheet, FC<SheetProps>>;

export const PlaySheetContent: FC<PlaySheetContent.Props> = () => {
	const controller = usePlaySheetContentController();
	const Sheet = bottomSheetByType[controller.renderedSheet];

	return (
		<Sheet
			boardItemId={controller.selectedBoardItemId}
			onClose={controller.closeSheet}
		/>
	);
};
