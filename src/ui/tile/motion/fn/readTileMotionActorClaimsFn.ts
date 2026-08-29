import { match } from "ts-pattern";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";

/** Returns every canonical actor whose presentation lifecycle is retained by one motion cue. */
export const readTileMotionActorClaimsFn = (cue: TileMotionCue) =>
	match(cue)
		.with(
			{
				kind: "spawn",
			},
			(spawn) =>
				new Set([
					spawn.actorId,
					spawn.originActorId,
				]),
		)
		.with(
			{
				kind: "stack",
			},
			(stack) =>
				new Set([
					stack.originActorId,
				]),
		)
		.with(
			{
				kind: "input",
			},
			(input) =>
				new Set([
					input.sourceActorId,
					input.targetActorId,
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
		.exhaustive();
