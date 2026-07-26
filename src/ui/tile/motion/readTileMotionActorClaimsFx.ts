import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

/** Returns every canonical actor whose direct input is owned by one motion cue. */
export const readTileMotionActorClaimsFx = Effect.fn("readTileMotionActorClaimsFx")(
	(cue: TileMotionCue) =>
		Effect.succeed(
			match(cue)
				.with(
					{
						kind: "spawn",
					},
					(spawn) =>
						new Set([
							spawn.actorId,
						]),
				)
				.with(
					{
						kind: "stack",
					},
					() => new Set<string>(),
				)
				.with(
					{
						kind: "swap",
					},
					(swap) =>
						new Set([
							swap.actorId,
							swap.counterpartActorId,
						]),
				)
				.exhaustive(),
		),
);
