import { useMemo } from "react";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { DetailCraftControl } from "~/v1/item-detail/control/DetailCraftControl";
import type { DetailProducerLineModel } from "~/v1/item-detail/control/DetailProducerLineModel";
import { readDetailCraftControl } from "~/v1/item-detail/control/readDetailCraftControl";
import { readDetailProducerLineControl } from "~/v1/item-detail/control/readDetailProducerLineControl";

export namespace useItemDetailControls {
	export interface Props {
		boardItem?: BoardViewItem;
		canSetDefaultLines: boolean;
		isPending: boolean;
		onClaimCraft(): void;
		onSetDefaultProductLine(productId: string): void;
		onStartCraft(): void;
		onStartProductLine(productId: string): void;
		onWithdrawCraftInput(itemId: string): void;
		onWithdrawProductLineInput(productId: string, itemId: string): void;
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
	onSetDefaultProductLine,
	onStartCraft,
	onStartProductLine,
	onWithdrawCraftInput,
	onWithdrawProductLineInput,
}: useItemDetailControls.Props): useItemDetailControls.Result => {
	const craft = boardItem?.craft;
	const productLines = boardItem?.activation?.productLines ?? [];
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
			productLines.map((line) => ({
				control: readDetailProducerLineControl({
					canSetDefault: canSetDefaultLines,
					line,
					onSetDefault: onSetDefaultProductLine,
					onStart: onStartProductLine,
					onWithdrawInput: onWithdrawProductLineInput,
					pending: isPending,
				}),
				line,
			})),
		[
			canSetDefaultLines,
			isPending,
			onSetDefaultProductLine,
			onStartProductLine,
			onWithdrawProductLineInput,
			productLines,
		],
	);

	return {
		craftControl,
		producerLineModels,
	};
};
