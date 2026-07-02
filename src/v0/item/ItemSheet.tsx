import { type FC, useMemo } from "react";
import { readLiveBoardItemView } from "~/v0/board/logic/readLiveBoardItemView";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import {
	useGameAction,
	useGameBoardItem,
	useGameItemCatalogView,
	useGameRuntimeStore,
} from "~/v0/play/runtime";
import { ItemDetailSheet } from "~/v0/item-detail/ItemDetailSheet";

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

	const setDefaultProducerLine = (lineId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			producerItemInstanceId: liveBoardItem.id,
			lineId,
			type: "producer.line.set_default",
		});
	};

	const startProducerLine = (lineId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			inputRefs: [],
			producerItemInstanceId: liveBoardItem.id,
			lineId,
			type: "producer.line.start",
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

	const withdrawProducerLineInput = (lineId: string, itemId: string) => {
		if (!liveBoardItem) return;
		void itemAction.run({
			itemId,
			producerItemInstanceId: liveBoardItem.id,
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
			onSetDefaultProducerLine={setDefaultProducerLine}
			onStartCraft={startCraft}
			onStartProducerLine={startProducerLine}
			onWithdrawCraftInput={withdrawCraftInput}
			onWithdrawProducerLineInput={withdrawProducerLineInput}
		/>
	);
};
