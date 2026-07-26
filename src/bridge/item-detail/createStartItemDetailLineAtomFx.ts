import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { Game } from "~/bridge/game/Game";
import { startLineFx } from "~/engine/job/write/startLineFx";

/**
 * Creates the isolated concurrent start command for one exact live Game.
 *
 * The scheduling yield stabilizes AsyncResult publication only; it does not
 * serialize commands or gate another interaction.
 */
export const createStartItemDetailLineAtomFx = Effect.fn("createStartItemDetailLineAtomFx")(
	(game: Game) =>
		Effect.succeed(
			Atom.fn(
				(command: startLineFx.Props) =>
					Effect.yieldNow.pipe(Effect.andThen(game.runFx(startLineFx(command)))),
				{
					concurrent: true,
				},
			).pipe(Atom.setIdleTTL(0)),
		),
);
