import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";

export namespace useAutofillItemDetailLine {
	export type Props = autofillLineInputsFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runAutofillFx = (game: Game, command: useAutofillItemDetailLine.Props) =>
	game.runFx(autofillLineInputsFx(command));

/** Autofills one exact Item Detail line through the canonical input command. */
export const useAutofillItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useAutofillItemDetailLine.Options) =>
	useItemDetailPendingCommand({
		action: "autofill",
		failureMessage: "Inputs could not be autofilled.",
		pendingKey,
		pendingOwner,
		run: runAutofillFx,
	});
