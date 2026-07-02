import { type FC, useMemo } from "react";
import { readLiveBoardItemView } from "~/board/logic/readLiveBoardItemView";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { toGameActionError } from "~/play/action/toGameActionError";
import {
	useGameAction,
	useGameBoardItem,
	useGameItemCatalogView,
	useGameRuntimeStore,
} from "~/play/runtime";
import { ItemDetailSheet } from "~/item-detail/ItemDetailSheet";

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
	const liveBoardItem = readLiveBoardItemView({
		boardItem,
		nowMs,
	});
	const actionError = itemAction.error;
	const actionErrorMessage = actionError ? toGameActionError(actionError).message : undefined;

	const setDefaultLine = (lineId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			itemInstanceId: liveBoardItem.id,
			lineId,
			type: "line.set_default",
		});
	};

	const startLine = (lineId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			inputRefs: [],
			itemInstanceId: liveBoardItem.id,
			lineId,
			type: "line.start",
		});
	};

	const claimCraft = () => {
		void runtimeStore.tick();
	};

	const startCraft = () => {
		if (!liveBoardItem?.craft) return;
		void itemAction.run({
			recipeId: liveBoardItem.craft.id,
			targetItemInstanceId: liveBoardItem.id,
			type: "craft.start",
		});
	};

	const withdrawCraftInput = (itemId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			itemId,
			quantity: 1,
			targetItemInstanceId: liveBoardItem.id,
			type: "craft.input.withdraw",
		});
	};

	const withdrawLineInput = (lineId: string, itemId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			itemId,
			itemInstanceId: liveBoardItem.id,
			lineId,
			type: "producer.input.withdraw",
		});
	};

	return (
		<ItemDetailSheet
			actionErrorMessage={actionErrorMessage}
			boardItem={liveBoardItem}
			canSetDefaultLines={liveBoardItem?.activation?.kind === "producer"}
			isPending={itemAction.isPending}
			items={items}
			onClaimCraft={claimCraft}
			onClose={onClose}
			onSetDefaultLine={setDefaultLine}
			onStartCraft={startCraft}
			onStartLine={startLine}
			onWithdrawCraftInput={withdrawCraftInput}
			onWithdrawLineInput={withdrawLineInput}
		/>
	);
};
