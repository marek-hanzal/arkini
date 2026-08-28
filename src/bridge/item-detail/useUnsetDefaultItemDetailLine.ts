import type { GameEngine } from "~/bridge/game/GameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { unsetDefaultLineFx } from "~/engine/line/write/unsetDefaultLineFx";

export namespace useUnsetDefaultItemDetailLine {
	export type Props = unsetDefaultLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runUnsetDefaultFx = (game: GameEngine, command: useUnsetDefaultItemDetailLine.Props) =>
	game.runEngineFx(unsetDefaultLineFx(command));

/** Removes the authoritative save-backed default line from an exact Item Detail owner. */
export const useUnsetDefaultItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useUnsetDefaultItemDetailLine.Options) =>
	useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey,
		pendingOwner,
		run: runUnsetDefaultFx,
	});
