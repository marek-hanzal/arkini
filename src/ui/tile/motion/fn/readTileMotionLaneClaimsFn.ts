import { match } from "ts-pattern";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";

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
export const readTileMotionLaneClaimsFn = (cue: TileMotionCue) => {
	const batchClaim = (
		actorId: string,
		batchKey = `${cue.sequence}:${cue.originActorId}`,
	): TileMotionLaneClaim => ({
		kind: "delivery-batch",
		actorId,
		batchKey,
	});
	return match(cue)
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
		.exhaustive();
};
