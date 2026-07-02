import { useMemo } from "react";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { DetailCraftControl } from "~/v0/item-detail/control/DetailCraftControl";
import type { DetailProducerLineModel } from "~/v0/item-detail/control/DetailProducerLineModel";
import { readDetailCraftControl } from "~/v0/item-detail/control/readDetailCraftControl";
import { readDetailProducerLineControl } from "~/v0/item-detail/control/readDetailProducerLineControl";

export namespace useItemDetailControls {
	export interface Props {
		boardItem?: BoardViewItem;
		canSetDefaultLines: boolean;
		isPending: boolean;
		onClaimCraft(): void;
		onSetDefaultProducerLine(lineId: string): void;
		onStartCraft(): void;
		onStartProducerLine(lineId: string): void;
		onWithdrawCraftInput(itemId: string): void;
		onWithdrawProducerLineInput(lineId: string, itemId: string): void;
	}

	export interface Result {
		craftControl?: DetailCraftControl;
		producerLineModels: readonly DetailProducerLineModel[];
	}
}

export const useItemDetailControls = ({
	boardItem,
	canSetDefaultLines,
	isPending,
	onClaimCraft,
	onSetDefaultProducerLine,
	onStartCraft,
	onStartProducerLine,
	onWithdrawCraftInput,
	onWithdrawProducerLineInput,
}: useItemDetailControls.Props): useItemDetailControls.Result => {
	const craft = boardItem?.craft;
	const producerLines = boardItem?.activation?.producerLines ?? [];
	const craftControl = useMemo(
		() =>
			craft
				? readDetailCraftControl({
						craft,
						onClaim: onClaimCraft,
						onStart: onStartCraft,
						onWithdrawInput: onWithdrawCraftInput,
						pending: isPending,
					})
				: undefined,
		[
			craft,
			isPending,
			onClaimCraft,
			onStartCraft,
			onWithdrawCraftInput,
		],
	);
	const producerLineModels = useMemo(
		() =>
			producerLines.map((line) => ({
				control: readDetailProducerLineControl({
					canSetDefault: canSetDefaultLines,
					line,
					onSetDefault: onSetDefaultProducerLine,
					onStart: onStartProducerLine,
					onWithdrawInput: onWithdrawProducerLineInput,
					pending: isPending,
				}),
				line,
			})),
		[
			canSetDefaultLines,
			isPending,
			onSetDefaultProducerLine,
			onStartProducerLine,
			onWithdrawProducerLineInput,
			producerLines,
		],
	);

	return {
		craftControl,
		producerLineModels,
	};
};
