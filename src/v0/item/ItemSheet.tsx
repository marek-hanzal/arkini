import { type FC, useMemo } from "react";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import { ItemStashDropsCard } from "~/v0/item/ui/ItemStashDropsCard";
import { readBoardItemStoreState } from "~/v0/item/logic/readBoardItemStoreState";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";
import { ItemCraftCard } from "~/v0/item/ui/ItemCraftCard";
import { ItemRequirementRulesCard } from "~/v0/item/ui/ItemRequirementRulesCard";
import { ItemProducerProductLinesCard } from "~/v0/item/ui/ItemProducerProductLinesCard";
import { ItemGeneratedEffectsCard } from "~/v0/item/ui/ItemGeneratedEffectsCard";
import { ItemRelationList } from "~/v0/item/ui/ItemRelationList";
import { ItemSummaryCard } from "~/v0/item/ui/ItemSummaryCard";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import {
	useGameAction,
	useGameBoardItem,
	useGameItemCatalogView,
	useGameRuntimeStore,
} from "~/v0/play/runtime";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";

export namespace ItemSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemSheet: FC<ItemSheet.Props> = ({ boardItemId, onClose }) => {
	const boardItem = useGameBoardItem(boardItemId ?? "");
	const items = useGameItemCatalogView();
	const itemAction = useGameAction();
	const runtimeStore = useGameRuntimeStore();
	const clockItems = useMemo(
		() =>
			boardItem
				? [
						boardItem,
					]
				: [],
		[
			boardItem,
		],
	);
	const nowMs = useProducerClock(clockItems);
	const item = boardItem ? items[boardItem.itemId] : undefined;
	const liveCraft = readLiveCraftView({
		craft: boardItem?.craft,
		nowMs,
	});
	const liveProductLines = useMemo(
		() =>
			boardItem?.activation?.productLines?.map((line) =>
				readLiveProducerProductLineView({
					line,
					nowMs,
				}),
			) ?? [],
		[
			boardItem?.activation?.productLines,
			nowMs,
		],
	);
	const storeState =
		boardItem && item
			? readBoardItemStoreState({
					boardItem,
					item,
				})
			: undefined;
	const actionError = itemAction.error;
	const actionErrorMessage = actionError ? toGameActionError(actionError).message : undefined;
	const craftHasRules = Boolean(liveCraft?.requirements?.length);
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
			<section
				data-ui="tile detail"
				className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
			>
				<SheetHeader
					title="Nothing selected"
					onClose={onClose}
				/>
				<div className="mx-auto min-h-0 w-full max-w-[520px] flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
					<p className="text-sm text-ak-text-muted">Select a board item first.</p>
				</div>
			</section>
		);
	}

	const setDefaultProductLine = (productId: string) => {
		void itemAction.run({
			producerItemInstanceId: boardItem.id,
			productId,
			type: "producer.product_line.set_default",
		});
	};

	const startProductLine = (productId: string) => {
		void itemAction.run({
			inputRefs: [],
			producerItemInstanceId: boardItem.id,
			productId,
			type: "producer.product.start",
		});
	};

	const claimCraft = () => {
		void runtimeStore.tick();
	};

	const startCraft = () => {
		if (!liveCraft) return;
		void itemAction.run({
			recipeId: liveCraft.id,
			targetItemInstanceId: boardItem.id,
			type: "craft.start",
		});
	};

	const withdrawCraftInput = (itemId: string) => {
		void itemAction.run({
			itemId,
			quantity: 1,
			targetItemInstanceId: boardItem.id,
			type: "craft.input.withdraw",
		});
	};

	const withdrawProductLineInput = (productId: string, itemId: string) => {
		void itemAction.run({
			itemId,
			producerItemInstanceId: boardItem.id,
			productId,
			type: "producer.input.withdraw",
		});
	};

	const storeBoardItem = () => {
		void itemAction
			.run({
				boardItemId: boardItem.id,
				type: "board.item.stash",
			})
			.then(onClose)
			.catch(() => undefined);
	};

	return (
		<section
			data-ui="tile detail"
			className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
		>
			<SheetHeader
				title={item.name}
				onClose={onClose}
			/>
			<div className="mx-auto min-h-0 w-full max-w-[520px] flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 text-sm text-ak-text [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
				{actionErrorMessage ? (
					<div className="rounded-sm border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-sm font-semibold text-rose-100">
						{actionErrorMessage}
					</div>
				) : null}
				<ItemSummaryCard
					item={item}
					storeDisabled={itemAction.isPending || storeState?.canStore !== true}
					onStore={storeBoardItem}
				/>
				<ItemGeneratedEffectsCard effects={item.generatedEffects} />
				{craftHasRules && liveCraft ? (
					<ItemRequirementRulesCard
						items={items}
						requirements={liveCraft.requirements}
						title="Craft rules"
					/>
				) : null}
				{liveCraft ? (
					<ItemCraftCard
						craft={liveCraft}
						items={items}
						pending={itemAction.isPending}
						onClaim={claimCraft}
						onStart={startCraft}
						onWithdrawInput={withdrawCraftInput}
					/>
				) : null}
				{boardItem.activation?.kind === "stash" ? (
					<ItemStashDropsCard
						drops={boardItem.activation.drops}
						items={items}
					/>
				) : null}
				{boardItem.activation?.inputs.length ||
				boardItem.activation?.requirements.length ? (
					<ItemRequirementRulesCard
						inputs={boardItem.activation.inputs}
						items={items}
						requirements={boardItem.activation.requirements}
						title={
							boardItem.activation.kind === "stash" ? "Stash rules" : "Producer rules"
						}
					/>
				) : null}
				{liveProductLines.length ? (
					<ItemProducerProductLinesCard
						items={items}
						lines={liveProductLines}
						pending={itemAction.isPending}
						canSetDefault={boardItem.activation?.kind === "producer"}
						onSetDefault={setDefaultProductLine}
						onStart={startProductLine}
						onWithdrawInput={withdrawProductLineInput}
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
