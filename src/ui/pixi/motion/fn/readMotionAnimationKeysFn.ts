import { match } from "ts-pattern";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";

export namespace readMotionAnimationKeysFn {
	export interface Props {
		readonly cue: TileMotionCue;
		readonly cueKey: string;
	}
}

/** Returns every animator key owned by one started motion cue. */
export const readMotionAnimationKeysFn = ({ cue, cueKey }: readMotionAnimationKeysFn.Props) =>
	match(cue)
		.with(
			{
				kind: "spawn",
			},
			() => [
				`motion:${cueKey}`,
			],
		)
		.with(
			{
				kind: "stack",
			},
			() => [
				`motion:${cueKey}`,
			],
		)
		.with(
			{
				kind: "input",
			},
			() => [
				`motion:${cueKey}:consume`,
				`motion:${cueKey}`,
			],
		)
		.with(
			{
				kind: "swap",
			},
			(swap) => [
				`motion:${cueKey}:${swap.actorId}`,
				`motion:${cueKey}:${swap.counterpartActorId}`,
			],
		)
		.exhaustive();
