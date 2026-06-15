import type { FC } from "react";
import { useItemDetailSheetController } from "~/item/hook/useItemDetailSheetController";
import { ItemActivationCard } from "~/item/ui/ItemActivationCard";
import { ItemActivationInputsCard } from "~/item/ui/ItemActivationInputsCard";
import { ItemCraftCard } from "~/item/ui/ItemCraftCard";
import { ItemRelationList } from "~/item/ui/ItemRelationList";
import { ItemSummaryCard } from "~/item/ui/ItemSummaryCard";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace ItemDetailSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemDetailSheet: FC<ItemDetailSheet.Props> = ({ boardItemId, onClose }) => {
	const detail = useItemDetailSheetController({
		boardItemId,
	});

	if (!detail) return null;

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<SheetHeader
				eyebrow="Item"
				description={detail.item.name}
				onClose={onClose}
			/>
			<div className="space-y-4 p-4 pt-1 text-sm text-slate-200">
				<ItemSummaryCard item={detail.item} />
				{detail.boardItem.craft ? (
					<ItemCraftCard
						craft={detail.boardItem.craft}
						items={detail.items}
					/>
				) : null}
				{detail.boardItem.activation ? (
					<ItemActivationCard
						activation={detail.boardItem.activation}
						nowMs={detail.nowMs}
					/>
				) : null}
				{detail.boardItem.activation?.inputs.length ||
				detail.boardItem.activation?.requirements.length ? (
					<ItemActivationInputsCard
						activation={detail.boardItem.activation}
						boardItem={detail.boardItem}
						items={detail.items}
						pending={detail.withdrawPending}
						onWithdraw={detail.onWithdraw}
					/>
				) : null}
				<ItemRelationList
					title="Can merge into"
					items={detail.items}
					relations={detail.mergeResults}
				/>
				<ItemRelationList
					title="Can be merged with"
					items={detail.items}
					relations={detail.usedInMerges}
				/>
				<ItemRelationList
					title="Used in crafts"
					items={detail.items}
					relations={detail.usedInCrafts}
				/>
			</div>
		</section>
	);
};
