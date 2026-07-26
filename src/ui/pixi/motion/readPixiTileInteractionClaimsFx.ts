import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiTileInteractionClaim } from "~/ui/pixi/motion/PixiTileMotionRuntime";

/** Projects one explicit claim per actor, with blocked interaction winning on overlap. */
export const readPixiTileInteractionClaimsFx = Effect.fn("readPixiTileInteractionClaimsFx")(
	(cues: ReadonlyArray<TileMotionCue>) =>
		Effect.sync(() => {
			const claims = new Map<string, PixiTileInteractionClaim>();
			for (const cue of cues) {
				match(cue)
					.with(
						{
							kind: "spawn",
						},
						(spawn) => {
							claims.set(spawn.actorId, "blocked");
						},
					)
					.with(
						{
							kind: "stack",
						},
						(stack) => {
							claims.set(stack.targetActorId, "blocked");
						},
					)
					.with(
						{
							kind: "swap",
						},
						(swap) => {
							for (const actorId of [
								swap.actorId,
								swap.counterpartActorId,
							]) {
								if (claims.get(actorId) !== "blocked") {
									claims.set(actorId, "activation-only");
								}
							}
						},
					)
					.exhaustive();
			}
			return claims;
		}),
);
