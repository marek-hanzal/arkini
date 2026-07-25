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
							spawn.originActorId,
							spawn.actorId,
						]),
				)
				.with(
					{
						kind: "stack",
					},
					(stack) =>
						new Set([
							stack.originActorId,
							stack.targetActorId,
						]),
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
