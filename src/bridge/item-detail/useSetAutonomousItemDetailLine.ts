import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { setLineAutonomousFx } from "~/engine/line/write/setLineAutonomousFx";

export namespace useSetAutonomousItemDetailLine {
	export type Props = setLineAutonomousFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runSetAutonomousFx = (game: Game, command: useSetAutonomousItemDetailLine.Props) =>
	game.runFx(setLineAutonomousFx(command));

/** Toggles one exact save-backed autonomous line selection. */
export const useSetAutonomousItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useSetAutonomousItemDetailLine.Options) =>
	useItemDetailPendingCommand({
		action: "autonomous",
		failureMessage: "Autonomous production could not be changed.",
		pendingKey,
		pendingOwner,
		run: runSetAutonomousFx,
	});
