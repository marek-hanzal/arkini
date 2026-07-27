import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";

export namespace useSetDefaultItemDetailLine {
	export type Props = setDefaultLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runSetDefaultFx = (game: Game, command: useSetDefaultItemDetailLine.Props) =>
	game.runFx(setDefaultLineFx(command));

/** Selects one authoritative save-backed default line for an exact Item Detail owner. */
export const useSetDefaultItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useSetDefaultItemDetailLine.Options) =>
	useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey,
		pendingOwner,
		run: runSetDefaultFx,
	});
