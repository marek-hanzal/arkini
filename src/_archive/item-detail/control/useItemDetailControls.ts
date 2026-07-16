import { useMemo } from "react";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { DetailCraftControl } from "~/item-detail/control/DetailCraftControl";
import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { readDetailCraftControl } from "~/item-detail/control/readDetailCraftControl";
import { readDetailLineControl } from "~/item-detail/control/readDetailLineControl";

export namespace useItemDetailControls {
	export interface Props {
		boardItem?: BoardViewItem;
		canSetDefaultLines: boolean;
		isPending: boolean;
		onClaimCraft(): void;
		onSetDefaultLine(lineId: string): void;
		onStartCraft(): void;
		onStartLine(lineId: string): void;
		onWithdrawCraftInput(itemId: string): void;
		onWithdrawLineInput(lineId: string, itemId: string): void;
	}

	export interface Result {
		craftControl?: DetailCraftControl;
		lineModels: readonly DetailLineModel[];
	}
}

export const useItemDetailControls = ({
	boardItem,
	canSetDefaultLines,
	isPending,
	onClaimCraft,
	onSetDefaultLine,
	onStartCraft,
	onStartLine,
	onWithdrawCraftInput,
	onWithdrawLineInput,
}: useItemDetailControls.Props): useItemDetailControls.Result => {
	const craft = boardItem?.craft;
	const lines = boardItem?.activation?.lines ?? [];
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
	const lineModels = useMemo(
		() =>
			lines.map((line) => ({
				control: readDetailLineControl({
					canSetDefault: canSetDefaultLines,
					line,
					onSetDefault: onSetDefaultLine,
					onStart: onStartLine,
					onWithdrawInput: onWithdrawLineInput,
					pending: isPending,
				}),
				line,
			})),
		[
			canSetDefaultLines,
			isPending,
			onSetDefaultLine,
			onStartLine,
			onWithdrawLineInput,
			lines,
		],
	);

	return {
		craftControl,
		lineModels,
	};
};
