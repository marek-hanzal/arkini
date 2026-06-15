import { useCallback, useMemo } from "react";
import { useBoardView } from "~/board/hook/useBoardView";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import type { ItemRelationList } from "~/item/ui/ItemRelationList";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import type { ItemId } from "~/manifest/manifestId";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { useProducerClock } from "~/producer/hook/useProducerClock";

export namespace useItemDetailSheetController {
	export interface Props {
		boardItemId?: string;
	}

	export interface State {
		boardItem: BoardViewItem;
		item: ViewItem;
		items: ReturnType<typeof usePlayItems>;
		nowMs: number;
		withdrawPending: boolean;
		onWithdraw(itemId: ItemId): void;
		mergeResults: ItemRelationList.Relation[];
		usedInMerges: ItemRelationList.Relation[];
		usedInCrafts: ItemRelationList.Relation[];
	}
}

export const useItemDetailSheetController = ({
	boardItemId,
}: useItemDetailSheetController.Props): useItemDetailSheetController.State | undefined => {
	const board = useBoardView();
	const items = usePlayItems();
	const invalidatePlayData = usePlayDataInvalidation();
	const nowMs = useProducerClock(board.items);
	const withdrawInput = useRunCommandMutation({
		invalidateOnSuccess: false,
	});
	const boardItem = boardItemId ? board.byId[boardItemId] : undefined;
	const item = boardItem ? items[boardItem.itemId] : undefined;
	const onWithdraw = useCallback(
		(itemId: ItemId) => {
			if (!boardItem) return;

			void withdrawInput
				.mutateAsync({
					type: "activation.withdrawInput",
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
		},
		[
			boardItem,
			invalidatePlayData,
			withdrawInput.mutateAsync,
		],
	);
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

	if (!boardItem || !item) return undefined;

	return {
		boardItem,
		item,
		items,
		nowMs,
		withdrawPending: withdrawInput.isPending,
		onWithdraw,
		mergeResults: relations.mergeResults,
		usedInMerges: relations.usedInMerges,
		usedInCrafts: relations.usedInCrafts,
	};
};
