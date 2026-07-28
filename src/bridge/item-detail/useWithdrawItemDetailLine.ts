import { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { withdrawLineInputFx } from "~/engine/input/write/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/engine/input/write/withdrawLineInputsFx";

export namespace useWithdrawItemDetailLine {
	export type Props = withdrawLineInputFx.Props | withdrawLineInputsFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runWithdrawFx = (game: Game, command: useWithdrawItemDetailLine.Props) =>
	game
		.runFx(
			"inputIndex" in command ? withdrawLineInputFx(command) : withdrawLineInputsFx(command),
		)
		.pipe(Effect.asVoid);

/** Withdraws one exact input or every buffered root from an Item Detail line. */
export const useWithdrawItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useWithdrawItemDetailLine.Options) =>
	useItemDetailPendingCommand({
		action: "withdraw",
		failureMessage: "Inputs could not be withdrawn.",
		pendingKey,
		pendingOwner,
		run: runWithdrawFx,
	});
