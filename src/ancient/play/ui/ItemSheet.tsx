import type { FC } from "react";
import { ItemDetailSheet } from "~/item/ui/ItemDetailSheet";

export namespace ItemSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemSheet: FC<ItemSheet.Props> = ({ boardItemId, onClose }) => (
	<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
		<ItemDetailSheet
			boardItemId={boardItemId}
			onClose={onClose}
		/>
	</section>
);
