import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiTileInteractionClaim } from "~/ui/pixi/motion/PixiTileMotionRuntime";

/** Projects drag ownership without turning presentation work into a click lock. */
export const readInteractionClaimsFx = Effect.fn("readInteractionClaimsFx")(
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
							claims.set(spawn.actorId, "handoff");
						},
					)
					.with(
						{
							kind: "stack",
						},
						() => {},
					)
					.with(
						{
							kind: "input",
						},
						(input) => {
							claims.set(input.sourceActorId, "activation-only");
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
								claims.set(actorId, "handoff");
							}
						},
					)
					.exhaustive();
			}
			return claims;
		}),
);
