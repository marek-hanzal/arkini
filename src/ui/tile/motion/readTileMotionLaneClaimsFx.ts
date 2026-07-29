import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export type TileMotionLaneClaim =
	| {
			readonly kind: "exclusive";
			readonly actorId: string;
	  }
	| {
			readonly kind: "delivery-batch";
			readonly actorId: string;
			readonly batchKey: string;
	  };

/** Separates exclusive actor motion from shareable deliveries in one producer batch. */
export const readTileMotionLaneClaimsFx = Effect.fn("readTileMotionLaneClaimsFx")(
	(cue: TileMotionCue) => {
		const batchClaim = (
			actorId: string,
			batchKey = `${cue.sequence}:${cue.originActorId}`,
		): TileMotionLaneClaim => ({
			kind: "delivery-batch",
			actorId,
			batchKey,
		});
		return Effect.succeed(
			match(cue)
				.with(
					{
						kind: "spawn",
					},
					(spawn): ReadonlyArray<TileMotionLaneClaim> => [
						batchClaim(spawn.originActorId),
						{
							kind: "exclusive",
							actorId: spawn.actorId,
						},
					],
				)
				.with(
					{
						kind: "stack",
					},
					(stack): ReadonlyArray<TileMotionLaneClaim> => [
						batchClaim(stack.originActorId),
						batchClaim(stack.targetActorId),
					],
				)
				.with(
					{
						kind: "input",
					},
					(input): ReadonlyArray<TileMotionLaneClaim> => [
						{
							kind: "exclusive",
							actorId: input.sourceActorId,
						},
						batchClaim(input.targetActorId, `input:${input.targetActorId}`),
					],
				)
				.with(
					{
						kind: "swap",
					},
					(swap): ReadonlyArray<TileMotionLaneClaim> => [
						{
							kind: "exclusive",
							actorId: swap.actorId,
						},
						{
							kind: "exclusive",
							actorId: swap.counterpartActorId,
						},
					],
				)
				.with(
					{
						kind: "relocation",
					},
					(relocation): ReadonlyArray<TileMotionLaneClaim> => [
						{
							kind: "exclusive",
							actorId: relocation.actorId,
						},
					],
				)
				.exhaustive(),
		);
	},
);
