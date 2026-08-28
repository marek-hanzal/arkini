import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export namespace readMotionAnimationKeysFx {
	export interface Props {
		readonly cue: TileMotionCue;
		readonly cueKey: string;
	}
}

/** Returns every animator key owned by one started motion cue. */
export const readMotionAnimationKeysFx = Effect.fn("readMotionAnimationKeysFx")(
	({ cue, cueKey }: readMotionAnimationKeysFx.Props) =>
		Effect.succeed(
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
				.exhaustive(),
		),
);
