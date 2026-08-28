import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
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

const runWithdrawFx = (game: GameEngine, command: useWithdrawItemDetailLine.Props) =>
	game
		.runEngineFx(
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
