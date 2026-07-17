import { Effect } from "effect";
import type { GameOwner } from "~/bridge/game/GameOwner";

/** Releases the current game and fails when its final save/disposal did not succeed. */
export const shutdownGameOwnerFx = Effect.fn("shutdownGameOwnerFx")((owner: GameOwner) =>
	owner.replaceFx(null),
);
