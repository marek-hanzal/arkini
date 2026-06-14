import type { FC } from "react";
import { ItemActivationCard } from "~/item/ui/ItemActivationCard";
import { ItemActivationInputsCard } from "~/item/ui/ItemActivationInputsCard";
import { ItemCraftCard } from "~/item/ui/ItemCraftCard";
import { ItemRelationList } from "~/item/ui/ItemRelationList";
import { ItemSummaryCard } from "~/item/ui/ItemSummaryCard";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace ItemDetailSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemDetailSheet: FC<ItemDetailSheet.Props> = ({ boardItemId, onClose }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const nowMs = useProducerClock(board?.items ?? []);
	const withdrawInput = useCommand({
		invalidateOnSuccess: false,
	});
	const boardItem = boardItemId ? board?.byId[boardItemId] : undefined;
	const item = boardItem ? items?.[boardItem.itemId] : undefined;

	if (!boardItem || !item || !items) return null;

	const activation = boardItem.activation;

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
				{activation ? (
					<ItemActivationCard
						activation={activation}
						nowMs={nowMs}
					/>
				) : null}
				{activation?.inputs.length ? (
					<ItemActivationInputsCard
						activation={activation}
						boardItem={boardItem}
						items={items}
						pending={withdrawInput.isPending}
						onWithdraw={(itemId) => {
							void withdrawInput
								.mutateAsync({
									type: "producer.withdrawInput",
									boardItemId: boardItem.id,
									itemId,
								})
								.then(() =>
									invalidatePlayData([
										"board",
										"inventory",
										"databaseStatus",
									]),
								);
						}}
					/>
				) : null}
				<ItemRelationList
					title="Can merge into"
					items={items}
					relations={(item.mergeResults ?? []).map((rule) => ({
						key: `${rule.withItemId}:${rule.resultItemId}`,
						leftItemId: rule.withItemId,
						resultItemId: rule.resultItemId,
					}))}
				/>
				<ItemRelationList
					title="Can be merged with"
					items={items}
					relations={(item.usedInMerges ?? []).map((rule) => ({
						key: `${rule.targetItemId}:${rule.resultItemId}`,
						leftItemId: rule.targetItemId,
						resultItemId: rule.resultItemId,
					}))}
				/>
				<ItemRelationList
					title="Used in crafts"
					items={items}
					relations={(item.usedInCrafts ?? []).map((recipe) => ({
						key: `${recipe.targetItemId}:${recipe.resultItemId}`,
						leftItemId: recipe.targetItemId,
						resultItemId: recipe.resultItemId,
					}))}
				/>
			</div>
		</section>
	);
};
