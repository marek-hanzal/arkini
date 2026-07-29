import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { removeCheatItemFx } from "~/engine/cheat/write/removeCheatItemFx";

export namespace removeDraggedCheatItemFx {
	export interface Props extends removeCheatItemFx.Props {
		readonly game: GameEngine;
	}
}

/**
 * Runs one cheat-authorized item removal through the exact live Game.
 * Expected stale, busy, or disabled command failures leave presentation recoverable.
 */
export const removeDraggedCheatItemFx = Effect.fn("removeDraggedCheatItemFx")(
	({ game, ...command }: removeDraggedCheatItemFx.Props) =>
		game.runFx(removeCheatItemFx(command)).pipe(
			Effect.as(true),
			Effect.catch(() => Effect.succeed(false)),
		),
);
