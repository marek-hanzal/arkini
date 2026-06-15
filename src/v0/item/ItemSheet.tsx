import { useSuspenseQuery } from "@tanstack/react-query";
import { type FC, useMemo } from "react";
import { ItemActivationCard } from "~/v0/item/ui/ItemActivationCard";
import { ItemActivationInputsCard } from "~/v0/item/ui/ItemActivationInputsCard";
import { ItemCraftCard } from "~/v0/item/ui/ItemCraftCard";
import { ItemRelationList } from "~/v0/item/ui/ItemRelationList";
import { ItemSummaryCard } from "~/v0/item/ui/ItemSummaryCard";
import type { ItemId } from "~/v0/manifest/manifestId";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { SheetHeader } from "~/v0/sheet/SheetHeader";
import { useWithdrawActivationInputMutation } from "~/v0/item/action/useWithdrawActivationInputMutation";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";
import { itemCatalogQueryOptions } from "~/v0/item/query/itemCatalogQueryOptions";

export namespace ItemSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemSheet: FC<ItemSheet.Props> = ({ boardItemId, onClose }) => {
	const { data: board } = useSuspenseQuery(boardViewQueryOptions());
	const { data: items } = useSuspenseQuery(itemCatalogQueryOptions());
	const withdrawActivationInputMutation = useWithdrawActivationInputMutation();
	const nowMs = useProducerClock(board.items);
	const boardItem = boardItemId ? board.byId[boardItemId] : undefined;
	const item = boardItem ? items[boardItem.itemId] : undefined;
	const relations = useMemo(
		() => ({
			mergeResults: (item?.mergeResults ?? []).map((rule) => ({
				key: `${rule.withItemId}:${rule.resultItemId}`,
				leftItemId: rule.withItemId,
				resultItemId: rule.resultItemId,
			})),
			usedInMerges: (item?.usedInMerges ?? []).map((rule) => ({
				key: `${rule.targetItemId}:${rule.resultItemId}`,
				leftItemId: rule.targetItemId,
				resultItemId: rule.resultItemId,
			})),
			usedInCrafts: (item?.usedInCrafts ?? []).map((recipe) => ({
				key: `${recipe.targetItemId}:${recipe.resultItemId}`,
				leftItemId: recipe.targetItemId,
				resultItemId: recipe.resultItemId,
			})),
		}),
		[
			item,
		],
	);

	if (!boardItem || !item) {
		return (
			<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
				<SheetHeader
					eyebrow="Item"
					description="Nothing selected"
					onClose={onClose}
				/>
				<p className="p-4 text-sm text-slate-400">Select a board item first.</p>
			</section>
		);
	}

	const withdraw = (itemId: ItemId) => {
		withdrawActivationInputMutation.mutate({
			boardItemId: boardItem.id,
			itemId,
		});
	};

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<SheetHeader
				eyebrow="Item"
				description={item.name}
				onClose={onClose}
			/>
			<div className="space-y-4 p-4 pt-1 text-sm text-slate-200">
				<ItemSummaryCard item={item} />
				{boardItem.craft ? (
					<ItemCraftCard
						craft={boardItem.craft}
						items={items}
					/>
				) : null}
				{boardItem.activation ? (
					<ItemActivationCard
						activation={boardItem.activation}
						nowMs={nowMs}
					/>
				) : null}
				{boardItem.activation?.inputs.length ||
				boardItem.activation?.requirements.length ? (
					<ItemActivationInputsCard
						activation={boardItem.activation}
						boardItem={boardItem}
						items={items}
						pending={withdrawActivationInputMutation.isPending}
						onWithdraw={withdraw}
					/>
				) : null}
				<ItemRelationList
					title="Can merge into"
					items={items}
					relations={relations.mergeResults}
				/>
				<ItemRelationList
					title="Can be merged with"
					items={items}
					relations={relations.usedInMerges}
				/>
				<ItemRelationList
					title="Used in crafts"
					items={items}
					relations={relations.usedInCrafts}
				/>
			</div>
		</section>
	);
};
