import { type FC, useMemo } from "react";
import { ItemActivationCard } from "~/v0/item/ui/ItemActivationCard";
import { ItemActivationInputsCard } from "~/v0/item/ui/ItemActivationInputsCard";
import { ItemCraftCard } from "~/v0/item/ui/ItemCraftCard";
import { ItemProducerProductLinesCard } from "~/v0/item/ui/ItemProducerProductLinesCard";
import { ItemRelationList } from "~/v0/item/ui/ItemRelationList";
import { ItemSummaryCard } from "~/v0/item/ui/ItemSummaryCard";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { useGameAction, useGameBoardView, useGameItemCatalogView } from "~/v0/play/runtime";

export namespace ItemSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemSheet: FC<ItemSheet.Props> = ({ boardItemId, onClose }) => {
	const board = useGameBoardView();
	const items = useGameItemCatalogView();
	const withdrawAction = useGameAction();
	const productLineAction = useGameAction();
	const nowMs = useProducerClock(board.items);
	const boardItem = boardItemId ? board.byId[boardItemId] : undefined;
	const item = boardItem ? items[boardItem.itemId] : undefined;
	const liveCraft = readLiveCraftView({
		craft: boardItem?.craft,
		nowMs,
	});
	const actionError = productLineAction.error ?? withdrawAction.error;
	const actionErrorMessage = actionError ? toGameActionError(actionError).message : undefined;
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
		void withdrawAction.run({
			itemId,
			quantity: 1,
			targetItemInstanceId: boardItem.id,
			type: "stored_requirement.withdraw",
		});
	};

	const setProductLineEnabled = (productId: string, enabled: boolean) => {
		void productLineAction.run({
			enabled,
			producerItemInstanceId: boardItem.id,
			productId,
			type: "producer.product_line.set_enabled",
		});
	};

	const startProductLine = (productId: string) => {
		void productLineAction.run({
			inputRefs: [],
			producerItemInstanceId: boardItem.id,
			productId,
			type: "producer.product.start",
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
				{actionErrorMessage ? (
					<div className="rounded-md border border-red-300/30 bg-red-950/35 px-3 py-2 text-xs font-semibold text-red-100">
						{actionErrorMessage}
					</div>
				) : null}
				<ItemSummaryCard item={item} />
				{liveCraft ? (
					<ItemCraftCard
						craft={liveCraft}
						items={items}
					/>
				) : null}
				{boardItem.activation ? (
					<ItemActivationCard
						activation={boardItem.activation}
						nowMs={nowMs}
					/>
				) : null}
				{boardItem.activation?.productLines?.length ? (
					<ItemProducerProductLinesCard
						lines={boardItem.activation.productLines}
						nowMs={nowMs}
						pending={productLineAction.isPending}
						onSetEnabled={setProductLineEnabled}
						onStart={startProductLine}
					/>
				) : null}
				{boardItem.activation?.inputs.length ||
				boardItem.activation?.requirements.length ? (
					<ItemActivationInputsCard
						activation={boardItem.activation}
						items={items}
						pending={withdrawAction.isPending}
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
